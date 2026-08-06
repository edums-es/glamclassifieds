# Database Blueprint — Sprint 1 (Revenue OS)

**Status:** Documento Oficial de Arquitetura de Banco de Dados  
**Versão:** 1.0  
**Escopo:** Sprint 1 — Cash Flow Core  
**Banco de Dados Principal:** PostgreSQL 16 (ver Seção 1)

Nenhum `CREATE TABLE` deve ser escrito antes da aprovação deste documento.  
Todo SQL futuro é consequência direta deste Blueprint.

---

## 1. Decisão de Banco de Dados: PostgreSQL vs MySQL

### Veredicto: PostgreSQL 16

**Justificativa técnica (não popularidade):**

| Critério | MySQL 8 | PostgreSQL 16 | Vencedor |
|---|---|---|---|
| Ledger Financeiro | `DECIMAL` ok, sem `CHECK` complexo | `DECIMAL`, `CHECK`, `EXCLUSION`, geração de sequências atômicas | **PG** |
| JSON nativo | `JSON`/`JSONB` limitado | `JSONB` com índices GIN, consultas avançadas com `@>` | **PG** |
| Full Text Search | Medíocre, requer MyISAM tricks | `tsvector`, `GIN`, ranqueamento nativo | **PG** |
| Views Materializadas | Não existe | Nativa (`MATERIALIZED VIEW`) | **PG** |
| Particionamento | Existe, mas limitado | Particionamento declarativo maduro (Range, Hash, List) | **PG** |
| Triggers | Básico | PLpgSQL, RETURN triggers, `BEFORE/AFTER/INSTEAD OF` | **PG** |
| Auditoria (`generated columns`) | Limitado | `GENERATED ALWAYS AS` para colunas calculadas | **PG** |
| Extensões (PostGIS, pg_cron, etc) | Não | Sim — pg_cron para workers sem infra extra | **PG** |
| Transações ACID em DDL | Não (DDL faz commit automático) | Sim — DDL dentro de transação | **PG** |
| Custo Operacional Inicial | Similar | Similar (mesma oferta em RDS, Supabase, Neon) | Empate |

**Decisão Final:** PostgreSQL 16. O Ledger Imutável, as Views Materializadas para dashboards do CRM, o JSONB para o Motor de Regras de Comissões e o particionamento para os logs de eventos são diferenciais concretos que MySQL simplesmente não entrega com a mesma maturidade.

---

## 2. Convenções Globais do Schema

Antes de qualquer tabela, convenções que serão seguidas por todos os módulos:

- **Chaves Primárias:** `BIGSERIAL` para tabelas transacionais de alto volume (Ledger, Eventos). `UUID v4` para entidades de negócio públicas (Members, Orders, Posts). `UUID v7` (ordenável no tempo, sortable) para tabelas onde a ordem de criação importa para filtros (será implementado via função helper no código, não no banco).
- **Nomenclatura:** `snake_case`. Tabelas sempre no plural. Módulo como prefixo: `auth_sessions`, `fin_invoices`.
- **Timestamps:** Toda tabela terá `created_at TIMESTAMPTZ DEFAULT NOW()`. Tabelas mutáveis terão `updated_at TIMESTAMPTZ DEFAULT NOW()` com trigger genérico de atualização.
- **Soft Delete:** Preferido via coluna `deleted_at TIMESTAMPTZ NULL` sobre exclusão física. Exceto tabelas imutáveis (Ledger), que não permitem deleção jamais.
- **Currency:** Todos os valores monetários são `BIGINT` representando centavos (ex: R$ 49,90 = `4990`). Zero risco de erro de arredondamento. Conversão é responsabilidade da aplicação.
- **Moeda Padrão:** `currency_code CHAR(3) DEFAULT 'BRL'`.

---

## 3. Eventos na Sprint 1 (Analytics Sem Custo Adicional)

**Problema:** Analytics completo requer um Data Warehouse (ClickHouse, BigQuery). Na Sprint 1 queremos coletar sem custo extra.

**Solução:** Uma única tabela `analytics_raw_events` no próprio PostgreSQL, **particionada por mês** (`PARTITION BY RANGE (created_at)`). Ela será:
- Append-only (apenas INSERT).
- Schema mínimo: `event_type`, `actor_id`, `actor_type`, `payload JSONB`, `session_id`, `created_at`.
- Na Sprint 3, essa tabela alimentará os Dashboards via Views Materializadas ou migração para ClickHouse.

Custo: R$ 0 extra. O particionamento por mês garante que queries em "últimos 30 dias" não varreram 2 anos de dados.

---

## 4. Blueprint por Módulo (Sprint 1)

### MÓDULO: Auth
**Objetivo:** Única fonte da verdade de identidade e sessão. Nenhum outro módulo deve validar senhas ou gerenciar tokens.

**Entidades:** `UserCredential`, `Session`, `PasswordResetToken`

**Tabelas:**
1. `auth_credentials` — Dados de autenticação (email + hash). Separado de `members` para permitir múltiplos métodos de login (OAuth) futuramente sem alterar a tabela de identidade.
2. `auth_sessions` — Sessões ativas. Permite revogação granular de sessões por dispositivo.
3. `auth_password_resets` — Tokens temporários de reset de senha.

**Chaves Primárias:**
- `auth_credentials.id`: `BIGSERIAL` — alta frequência de leitura, JOIN com `members` via `member_id`.
- `auth_sessions.id`: `UUID` — tokens de sessão são UUIDs, faz sentido o PK ser o próprio token.
- `auth_password_resets.token`: `CHAR(64)` — hash SHA-256 do token enviado por e-mail.

**Relacionamentos:**
- `auth_credentials` 1:1 → `members` (um membro, uma credencial principal)
- `auth_credentials` 1:N → `auth_sessions` (uma credencial, várias sessões ativas)

**Índices:**
- `auth_credentials(email)` — UNIQUE. Toda autenticação começa pelo e-mail.
- `auth_sessions(member_id, expires_at)` — Verificação de sessão válida (a query mais frequente de toda a aplicação).
- `auth_sessions(expires_at)` WHERE `expires_at < NOW()` — Índice parcial para limpeza de sessões expiradas (cron job).
- `auth_password_resets(token)` — UNIQUE + `expires_at` para invalidação rápida.

**Constraints:**
- `auth_sessions.expires_at > created_at` — CHECK para integridade.
- `auth_password_resets.used_at` NULL enquanto não usado.

**Triggers:** Nenhum. A lógica de expiração de sessão é resolvida na aplicação e por cron job periódico.

**Dependências:** Nenhuma. É o módulo mais primitivo.

---

### MÓDULO: Members
**Objetivo:** Perfil de negócio do usuário (dados pessoais, preferências). Separado de Auth por Single Responsibility — autenticação muda por razões diferentes de perfil.

**Entidades:** `MemberProfile`, `MemberDevice`

**Tabelas:**
1. `members` — Dados demográficos e de contato do usuário.
2. `member_devices` — Dispositivos conhecidos. Vital para o CRM mostrar "acessou via iPhone" e para o Tracking Engine hashear User-Agent para deduplicação de eventos.

**Chaves Primárias:**
- `members.id`: `BIGSERIAL` — FK de alta frequência em quase todos os módulos.
- `member_devices.id`: `BIGSERIAL`.

**Relacionamentos:**
- `members` 1:N → `auth_credentials` (um membro pode ter múltiplas credenciais futuramente)
- `members` 1:N → `member_devices`

**Índices:**
- `members(email)` — UNIQUE (backup de busca além do Auth).
- `members(created_at)` — Para o CRM filtrar leads por período de cadastro.
- `member_devices(member_id, fingerprint)` — UNIQUE. Evita duplicar o mesmo dispositivo.

**Constraints:**
- `members.email` — NOT NULL, formato validado na aplicação.
- `members.status` — ENUM: `active | suspended | banned`. NOT NULL DEFAULT `active`.

**Triggers:**
- Trigger genérico de `updated_at` (um único trigger reutilizável em todos os módulos que tiverem `updated_at`).

---

### MÓDULO: Permissions
**Objetivo:** RBAC centralizado. Define quem pode fazer o quê na plataforma (Admin, Atendente, Criadora, Membro).

**Entidades:** `Role`, `Permission`, `RoleAssignment`

**Tabelas:**
1. `perm_roles` — Papéis do sistema (admin, attendant, creator, member).
2. `perm_permissions` — Capacidades granulares (ex: `orders:view`, `commissions:manage`).
3. `perm_role_permissions` — Tabela de junção N:N entre Roles e Permissions.
4. `perm_member_roles` — Papéis atribuídos a cada membro.

**Chaves Primárias:**
- `perm_roles.id`: `SMALLSERIAL` — poucos papéis, inteiro pequeno.
- `perm_permissions.id`: `SMALLSERIAL`.
- Tabelas de junção usam chaves compostas como PK.

**Relacionamentos:**
- `perm_roles` N:N → `perm_permissions` (via `perm_role_permissions`)
- `members` N:N → `perm_roles` (via `perm_member_roles`)

**Índices:**
- `perm_member_roles(member_id)` — A query "que papéis esse membro tem?" é feita em toda requisição autenticada.

**Triggers:** Nenhum.

**Nota:** Os papéis iniciais serão `admin`, `attendant`, `creator`, `member`. A granularidade de `permissions` será usada futuramente para o painel de delegação de acesso.

---

### MÓDULO: Classifieds
**Objetivo:** Anúncios públicos (produto original). Manutenção do módulo existente, migrado para o novo schema.

**Entidades:** `ClassifiedAd`, `ClassifiedPhoto`

**Tabelas:**
1. `classified_ads` — Anúncio completo (compatível com a tabela `profiles` existente, renomeada e prefixada).
2. `classified_photos` — Fotos do anúncio (compatível com `profile_photos` existente).
3. `classified_submission_limits` — Rate limiting de IPs (compatível com `submission_limits` existente).

**Chaves Primárias:**
- `classified_ads.id`: `UUID` — já existe no schema atual como `CHAR(36)`. Mantido.

**Índices:**
- `classified_ads(status, is_featured, created_at)` — Já existe. Mantido.
- `classified_ads(city)` — Já existe. Mantido.
- `classified_ads(member_id)` — Para o painel do membro ver seus anúncios.

**Nota de Migração:** As tabelas `profiles`, `profile_photos`, `submission_limits` do schema atual serão renomeadas para `classified_*` durante a migração. Zero perda de dados.

---

### MÓDULO: Only
**Objetivo:** Conteúdo exclusivo pago. Perfis de Criadoras, Posts e controle de acesso baseado em assinaturas ativas.

**Entidades:** `CreatorProfile`, `Post`, `PostAccess`

**Tabelas:**
1. `only_creators` — Perfil comercial da Criadora (bio, preço de assinatura, status KYC).
2. `only_posts` — Publicações da Criadora (texto + referências a mídias).
3. `only_post_access` — Cache de acesso: "Membro X tem acesso ao conteúdo da Criadora Y até data Z". Alimentado por eventos do módulo Finance. Evita JOIN pesado com `fin_subscriptions` em toda request de conteúdo.

**Chaves Primárias:**
- `only_creators.id`: `UUID`
- `only_posts.id`: `UUID`
- `only_post_access.id`: `BIGSERIAL` — Alta frequência de insert/update.

**Relacionamentos:**
- `members` 1:1 → `only_creators`
- `only_creators` 1:N → `only_posts`
- `only_post_access` N:N → `members` + `only_creators`

**Índices:**
- `only_post_access(member_id, creator_id)` — UNIQUE. A query mais crítica do módulo: "Esse membro tem acesso a essa Criadora?". Deve ser sub-milissegundo.
- `only_post_access(expires_at)` WHERE `status = 'active'` — Índice parcial para o cron de expiração.
- `only_posts(creator_id, published_at DESC)` — Feed cronológico da Criadora.
- `only_creators(status)` — Listagem de criadoras ativas.

**Constraints:**
- `only_creators.subscription_price_cents >= 0` — CHECK.
- `only_creators.status` — ENUM: `pending_kyc | active | suspended | banned`.
- `only_post_access.status` — ENUM: `active | expired | revoked`.

**Triggers:** Nenhum. Acesso é controlado por evento `SubscriptionCreated` do Finance, processado pela aplicação.

---

### MÓDULO: Media
**Objetivo:** Metadados de mídias (fotos e vídeos). O storage físico é delegado a S3/CDN. O banco nunca armazena binários.

**Entidades:** `MediaAsset`, `EncodingJob`

**Tabelas:**
1. `media_assets` — Metadados de cada arquivo (tipo, URL, blur_hash, dimensões, status).
2. `media_encoding_jobs` — Fila de processamento (blur, transcode). Permite rastrear falhas de encoding.

**Chaves Primárias:**
- `media_assets.id`: `UUID`
- `media_encoding_jobs.id`: `BIGSERIAL`

**Relacionamentos:**
- `media_assets` é referenciada por `only_posts` e `classified_ads` (polimórfica via `owner_type` + `owner_id`).
- `media_assets` 1:N → `media_encoding_jobs`

**Índices:**
- `media_assets(owner_type, owner_id)` — Para listar mídias de um post/anúncio.
- `media_encoding_jobs(status, created_at)` WHERE `status = 'pending'` — Índice parcial para o worker de processamento.

**Constraints:**
- `media_assets.media_type` — ENUM: `image | video`.
- `media_encoding_jobs.status` — ENUM: `pending | processing | completed | failed`.
- `media_assets.storage_key` — NOT NULL. Nunca armazenamos URL absoluta (se o S3 bucket mudar, só atualiza a função que monta a URL).

---

### MÓDULO: Products
**Objetivo:** Catálogo central de tudo que pode ser cobrado. Desacopla preços de negócio dos módulos de conteúdo.

**Entidades:** `Product`, `Price`

**Tabelas:**
1. `products` — Cada coisa vendável: Assinatura da Criadora X, PPV, Pack, Destaque de Classificado.
2. `product_prices` — Preços e billing intervals. Uma tabela separada permite múltiplos preços por produto (ex: mensal vs anual) e histórico de mudanças de preço sem alterar o produto base.

**Chaves Primárias:**
- `products.id`: `UUID`
- `product_prices.id`: `UUID`

**Relacionamentos:**
- `products` 1:N → `product_prices`
- `only_creators` 1:N → `products` (cada criadora tem seu produto de assinatura)

**Índices:**
- `products(owner_type, owner_id, type)` — "Qual o produto de assinatura da Criadora Y?"
- `product_prices(product_id, is_active)` — Preço ativo de um produto.

**Constraints:**
- `products.type` — ENUM: `subscription | ppv | pack | featured_ad`.
- `product_prices.amount_cents > 0` — CHECK.
- `product_prices.billing_interval` — ENUM: `one_time | monthly | yearly`.

---

### MÓDULO: Orders
**Objetivo:** Captura a intenção de compra. Existe independente do pagamento. Permite rastrear abandonos mesmo sem pagamento iniciado.

**Entidades:** `Order`, `OrderItem`

**Tabelas:**
1. `orders` — Cabeçalho do pedido (quem compra, total, status).
2. `order_items` — Itens do pedido (o que está sendo comprado, preço unitário na hora da compra — snapshot de preço).

**Chaves Primárias:**
- `orders.id`: `UUID` — Enviado como `order_reference` ao gateway. Nunca AUTO_INCREMENT para não expor volume de pedidos.
- `order_items.id`: `BIGSERIAL`.

**Relacionamentos:**
- `members` 1:N → `orders`
- `orders` 1:N → `order_items`
- `order_items` N:1 → `product_prices` (FK para o preço exato no momento da compra)

**Índices:**
- `orders(member_id, status, created_at DESC)` — CRM do cliente: "Pedidos recentes".
- `orders(status, created_at)` WHERE `status = 'pending'` — Índice parcial para o Recovery Engine detectar abandonos.

**Constraints:**
- `orders.status` — ENUM: `draft | pending | paid | failed | canceled | refunded`.
- `order_items.unit_price_cents >= 0` — CHECK (snapshot imutável do preço).

---

### MÓDULO: Payments
**Objetivo:** Única interface com gateways externos (Pagar.me, Stripe). Isola a complexidade de cada gateway do restante da plataforma.

**Entidades:** `PaymentTransaction`, `PaymentMethod`, `GatewayWebhookLog`

**Tabelas:**
1. `pay_transactions` — Cada tentativa de cobrança. Contém o ID externo do gateway.
2. `pay_methods` — Métodos de pagamento salvos (cartão tokenizado, nunca dados reais).
3. `pay_webhook_logs` — Log bruto de TODOS os webhooks recebidos do gateway. Crítico para debug e idempotência (evitar processar o mesmo webhook duas vezes).

**Chaves Primárias:**
- `pay_transactions.id`: `UUID` = valor de `orders.id`. Um-para-um no início; permite N transações por pedido no futuro (retry de pagamento).
- `pay_webhook_logs.id`: `BIGSERIAL`.

**Relacionamentos:**
- `orders` 1:N → `pay_transactions`
- `members` 1:N → `pay_methods`

**Índices:**
- `pay_transactions(gateway_transaction_id)` — UNIQUE. Idempotência: ao receber webhook, busca pelo ID do gateway.
- `pay_webhook_logs(gateway, event_id)` — UNIQUE. Impede reprocessamento do mesmo evento.
- `pay_methods(member_id, is_default)` — Cartão padrão do membro.

**Constraints:**
- `pay_transactions.status` — ENUM: `pending | authorized | captured | failed | refunded | chargebacked`.
- `pay_methods.brand` — ENUM: `visa | mastercard | elo | pix | other`.
- `pay_webhook_logs.processed_at` — NULL até ser processado com sucesso.

**Nota de Segurança:** `pay_methods` armazena apenas tokens do gateway (ex: `card_token_abc123`). Dados de cartão nunca tocam nosso banco. PCI-DSS não se aplica ao nosso servidor.

---

### MÓDULO: Finance
**Objetivo:** Orquestra o que um pagamento aprovado significa para o negócio: cria Subscription, libera acesso, emite Invoice.

**Entidades:** `Invoice`, `Subscription`

**Tabelas:**
1. `fin_invoices` — Documento fiscal/contábil gerado por cada pagamento aprovado.
2. `fin_subscriptions` — Assinaturas recorrentes ativas (status, período vigente, renovação).

**Chaves Primárias:**
- `fin_invoices.id`: `UUID`
- `fin_subscriptions.id`: `UUID`

**Relacionamentos:**
- `orders` 1:1 → `fin_invoices`
- `fin_invoices` 1:N → `fin_subscriptions` (Invoice de renovação cria nova entrada na subscription)
- `fin_subscriptions` N:1 → `members`
- `fin_subscriptions` N:1 → `only_creators`

**Índices:**
- `fin_subscriptions(member_id, creator_id, status)` — UNIQUE PARCIAL onde `status = 'active'`. Regra de negócio: apenas 1 assinatura ativa por par membro+criadora.
- `fin_subscriptions(current_period_end, status)` WHERE `status = 'active'` — Para o cron de renovação automática.
- `fin_subscriptions(status)` — Dashboard de MRR/Churn.

**Constraints:**
- `fin_subscriptions.status` — ENUM: `trialing | active | past_due | canceled | expired`.
- `fin_invoices.total_cents >= 0` — CHECK.

**Views (futuras):**
- `v_mrr_snapshot` — View Materializada calculando MRR atual agregando assinaturas ativas. Atualizada periodicamente (não em tempo real).

---

### MÓDULO: Ledger
**Objetivo:** Livro-razão imutável de duplo lançamento. Nenhuma outra tabela do sistema pode ser a fonte da verdade financeira. O Ledger é o ouro.

**Entidades:** `LedgerAccount`, `LedgerEntry`

**Tabelas:**
1. `ldg_accounts` — Contas contábeis (Platform Revenue, Creator:UUID, Attendant:UUID, Gateway Fee).
2. `ldg_entries` — Cada lançamento (crédito ou débito). **NUNCA sofre UPDATE ou DELETE.**

**Chaves Primárias:**
- `ldg_accounts.id`: `BIGSERIAL`.
- `ldg_entries.id`: `BIGSERIAL` — Volume máximo, precisa de insert rápido.

**Particionamento:**
- `ldg_entries` particionada por `RANGE (created_at)` — por mês. Uma transação de Janeiro 2026 nunca será lida junto com dados de Agosto 2027. Mantém o índice pequeno e eficiente.

**Relacionamentos:**
- `ldg_entries` N:1 → `ldg_accounts`
- `ldg_entries` N:1 → `fin_invoices` (rastreabilidade: "esse lançamento veio de qual Invoice?")

**Índices:**
- `ldg_entries(account_id, created_at DESC)` — Extrato de uma conta.
- `ldg_entries(reference_id, reference_type)` — "Todos os lançamentos desta Invoice/Transaction".

**Constraints:**
- `ldg_entries.entry_type` — ENUM: `credit | debit`.
- `ldg_entries.amount_cents > 0` — CHECK. Valores SEMPRE positivos. O `entry_type` define a direção.
- **Sem `deleted_at`.** Sem `updated_at`. A tabela é append-only por design.
- Row-level security para impedir DELETE mesmo para role de admin de banco.

**Triggers:**
- **SIM, único trigger justificado:** Após INSERT em `ldg_entries`, atualizar o `cached_balance` na tabela `wlt_wallets` (Wallet). É a única exceção de trigger porque garante consistência atômica sem depender de dois roundtrips de rede na aplicação.

---

### MÓDULO: Commissions
**Objetivo:** Motor de regras que calcula como uma transação é dividida. Zero lógica hardcoded.

**Entidades:** `CommissionRule`, `CommissionSplit`

**Tabelas:**
1. `com_rules` — Regras configuráveis com condições em JSONB e percentuais de split.
2. `com_splits` — Resultado do cálculo: "nesta Invoice, o Atendente X ganhou R$ Y". Registro imutável gerado após `CommissionCalculated`.

**Chaves Primárias:**
- `com_rules.id`: `SMALLSERIAL` — Poucas regras.
- `com_splits.id`: `BIGSERIAL`.

**Relacionamentos:**
- `com_rules` sem FK externa (é self-contained).
- `com_splits` N:1 → `fin_invoices`
- `com_splits` N:1 → `ldg_accounts` (aponta para qual conta do Ledger receberá o crédito)

**Índices:**
- `com_rules(is_active, priority DESC)` — O Motor lê as regras em ordem de prioridade. Cache desta query em memória pela aplicação (regras mudam raramente).
- `com_splits(invoice_id)` — "Quais splits esta invoice gerou?".
- `com_splits(beneficiary_id, created_at DESC)` — Extrato de comissões de um Atendente.

**Constraints:**
- `com_rules.conditions` — JSONB NOT NULL.
- `com_rules.platform_pct + creator_pct + affiliate_pct = 100` — CHECK crítico para garantir que o split nunca ultrapasse 100%.
- `com_splits.amount_cents >= 0` — CHECK.

---

### MÓDULO: Tracking Engine
**Objetivo:** Única interface entre a plataforma e redes de publicidade externas. Controla qualidade de sinal, deduplicação e mapeamento de eventos.

**Entidades:** `TrackingEventMap`, `TrackingDispatchLog`, `TrackingConsent`

**Tabelas:**
1. `trk_event_maps` — Mapeamento: "evento interno `SubscriptionCreated` = `Purchase` no Meta e `purchase` no GA4". Configurável pelo Admin sem deploy.
2. `trk_dispatch_logs` — Log de cada envio a uma plataforma externa (Meta CAPI, GA4 Measurement Protocol). Armazena o payload enviado e a resposta. Vital para Tracking Health.
3. `trk_consents` — Registro de consentimento LGPD/GDPR do usuário por sessão. Determina quais plataformas podem receber dados daquele usuário.

**Chaves Primárias:**
- `trk_event_maps.id`: `SMALLSERIAL` — Poucas regras de mapeamento.
- `trk_dispatch_logs.id`: `BIGSERIAL` — Alto volume.
- `trk_consents.id`: `BIGSERIAL`.

**Particionamento:**
- `trk_dispatch_logs` particionada por mês (alto volume de logs de envio).

**Índices:**
- `trk_event_maps(internal_event, platform)` — UNIQUE. "Como traduzir `SubscriptionCreated` para `meta`?".
- `trk_dispatch_logs(platform, status, created_at DESC)` WHERE `status = 'failed'` — Índice parcial para o Health Dashboard mostrar falhas recentes.
- `trk_dispatch_logs(event_id)` — Deduplicação: verificar se aquele `event_id` já foi enviado.
- `trk_consents(member_id, session_id)` — Leitura antes de qualquer dispatch externo.

**Constraints:**
- `trk_event_maps.platform` — ENUM: `meta | google_ads | ga4 | tiktok | gtm`.
- `trk_dispatch_logs.status` — ENUM: `sent | failed | duplicate_skipped`.
- `trk_consents.consent_level` — ENUM: `none | analytics | marketing | full`.

**Views:**
- `v_tracking_health` — View simples: taxa de falha por plataforma nas últimas 24h. Alimenta o Health Dashboard do Admin.

---

### MÓDULO: Settings & Feature Flags
**Objetivo:** Eliminar qualquer valor de negócio hardcoded. Permite mudanças operacionais sem deploy.

**Tabelas:**
1. `sys_settings` — Configurações globais chave-valor tipadas.
2. `sys_feature_flags` — Flags binárias ou percentuais (para rollout gradual).

**Chaves Primárias:**
- `sys_settings.key`: `VARCHAR(80)` — O próprio nome da config é a PK.
- `sys_feature_flags.key`: `VARCHAR(80)` — Idem.

**Índices:** Nenhum além da PK. Tabelas pequenas, sempre em cache pela aplicação.

**Constraints:**
- `sys_settings.value_type` — ENUM: `string | integer | decimal | boolean | json`.
- `sys_feature_flags.rollout_pct BETWEEN 0 AND 100` — CHECK.

---

### MÓDULO: Ownership
**Objetivo:** Rastrear quem é responsável por cada entidade de negócio. Permite transferência de carteira sem perda de histórico de atribuição original.

**Tabelas:**
1. `ownership_records` — Polimórfica. `entity_type` + `entity_id` + `owner_type` + `owner_id` + `role` + `valid_from` + `valid_until`.

**Chave Primária:** `BIGSERIAL`.

**Índices:**
- `(entity_type, entity_id, valid_until)` WHERE `valid_until IS NULL` — Índice parcial: "dono atual de uma entidade".
- `(owner_id, owner_type, entity_type)` — "Toda a carteira de um atendente".

**Nota de Design:** Uma única tabela polimórfica é justificada aqui porque o padrão de acesso é uniforme para todos os tipos de entidade (Members, Creators, Recovery Tasks). Não haverá JOINs complexos — a aplicação consulta por `entity_type + entity_id` e recebe o owner. Simples.

---

## 5. Mapa de Dependências (Ordem de Criação)

A ordem de criação das tabelas deve respeitar as FKs entre módulos:

```
1. sys_settings, sys_feature_flags         (Foundation - sem deps)
2. auth_credentials, auth_sessions         (Core - sem deps externas)
3. members, member_devices                 (Core - depende de auth)
4. perm_roles, perm_permissions            (Core - sem deps externas)
5. perm_role_permissions, perm_member_roles (Core - depende de perm + members)
6. ownership_records                       (Core - sem deps de FK, polimórfico)
7. media_assets, media_encoding_jobs       (Content - sem deps de negócio)
8. products, product_prices                (Commerce - sem deps de FK além de creators)
9. classified_ads, classified_photos       (Content - depende de members)
10. only_creators                          (Content - depende de members)
11. only_posts, only_post_access           (Content - depende de creators + members)
12. orders, order_items                    (Commerce - depende de members + product_prices)
13. pay_methods, pay_transactions          (Payments - depende de members + orders)
14. pay_webhook_logs                       (Payments - sem FK externas)
15. fin_invoices, fin_subscriptions        (Finance - depende de orders + members + creators)
16. ldg_accounts                           (Ledger - sem FK externas)
17. ldg_entries                            (Ledger - depende de ldg_accounts + fin_invoices)
18. com_rules                              (Commissions - sem FKs externas)
19. com_splits                             (Commissions - depende de fin_invoices + ldg_accounts)
20. trk_event_maps, trk_consents          (Tracking - depende de members)
21. trk_dispatch_logs                      (Tracking - sem FK externas, particionada)
22. analytics_raw_events                   (Analytics - sem FK, append-only, particionada)
```

---

## 6. Revisão Crítica Final

**Decisões que questionei e mantive:**
- ✅ `only_post_access` como tabela separada (e não um JOIN com `fin_subscriptions`): Correto. A query de acesso acontece em toda visualização de conteúdo. Um JOIN com subscriptions seria 10x mais lento e acoplaria Content ao Finance.
- ✅ Valores monetários em `BIGINT` (centavos): Correto. `DECIMAL` tem overhead e risco de rounding. `BIGINT` é a prática da Stripe.
- ✅ `pay_webhook_logs` como tabela separada: Correto. É a primeira linha de defesa contra duplo processamento.

**Riscos Identificados:**
- ⚠️ `com_rules.conditions` em JSONB é flexível mas pode ser lento para regras complexas com muitas condições. Mitigação: as regras ficam em cache (Redis ou memória PHP) e são recarregadas apenas quando `sys_settings` muda.
- ⚠️ Trigger em `ldg_entries` para atualizar `wlt_wallets` (Sprint 2): Deve ser revisado quando o Wallet for implementado. Se o volume for extremamente alto, avaliar se um worker assíncrono é mais adequado.

**Simplificações adotadas:**
- ❌ Removido: Tabela separada de `audit_logs` na Sprint 1. A auditoria de mudanças em tabelas críticas (como `com_rules`) será feita pela aplicação registrando em `analytics_raw_events` como evento interno. Sprint 2 poderá ter uma tabela dedicada se necessário.
- ❌ Removido: Schema de `Wallet` da Sprint 1. O saldo pode ser calculado agregando `ldg_entries` por enquanto. Wallet (com `cached_balance`) entra na Sprint 2 quando o volume justificar.

---

*Documento aprovado para início da geração do SQL incremental por módulo.*