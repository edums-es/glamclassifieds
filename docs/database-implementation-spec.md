# Database Implementation Specification (SQL Constitution)

**Autor:** Principal PostgreSQL Database Engineer (Staff+)
**Foco:** Regras Estritas e Padrões Obrigatórios para Escrita do SQL Schema
**Status:** Architecture Freeze v1.0 (Locked)

Este documento atua como a **Constituição da Implementação SQL**. Todo script SQL, DDL ou DML gerado para a plataforma deve obedecer incondicionalmente a estas regras. Nenhuma linha de código SQL pode violar os padrões aqui definidos. 

*NÃO contém código SQL. Contém as leis físicas e lógicas da codificação estrutural.*

---

## 1. Convenção de Nomes (Naming Conventions)

**REGRA PERMANENTE (IMUTABILIDADE DE MIGRATIONS):**
Migrations já materializadas são imutáveis. Nenhuma migration existente (como V001 a V004) poderá ser reescrita ou modificada in-place (seja via alteração de arquivo ou script). Qualquer ajuste, correção de bug ou alteração estrutural futura deverá ser feita **exclusivamente através de uma nova migration corretiva** (ex: `V004_2__nova_correcao.sql`). O histórico de migrations deve permanecer linear, append-only, auditável e reprodutível.

Padrão Universal: `snake_case` e letras minúsculas (lowercase). É estritamente proibido o uso de *CamelCase* ou *PascalCase* em qualquer objeto do banco.

*   **Schemas:** Substantivos no singular ou plural sem prefixos lixo (ex: `auth`, `core`, `commerce`).
*   **Tabelas:** Substantivos no plural (ex: `members`, `outbox_events`). Nunca usar prefixos de módulo no nome da tabela, o schema já cumpre esse papel (ex: `finance.wallets`, não `finance.finance_wallets`).
*   **Colunas:** Nomes explícitos, singulares (ex: `account_status`, `document_cpf`). Chaves primárias sempre se chamam `id`.
*   **Primary Keys (PKs):** `pk_{tabela}` (ex: `pk_members`).
*   **Foreign Keys (FKs):** `fk_{tabela}_{coluna}_{tabela_ref}` (ex: `fk_wallets_member_id_members`).
*   **Índices (Indexes):**
    *   B-Tree: `idx_{tabela}_{colunas}`
    *   Unique: `uidx_{tabela}_{colunas}`
    *   GIN: `idx_{tabela}_{coluna}_gin`
    *   Parciais: `idx_{tabela}_{coluna}_partial`
*   **Constraints:**
    *   Check: `ck_{tabela}_{regra}` (ex: `ck_wallets_balance_positive`).
    *   Unique: `uk_{tabela}_{colunas}`.
    *   Exclude: `excl_{tabela}_{regra}`.
*   **Sequences:** Gerenciadas implicitamente via `IDENTITY`, mas se necessárias: `seq_{tabela}_{coluna}`.
*   **Triggers:** `trg_{timing}_{action}_{tabela}` (ex: `trg_before_update_members_timestamp`).
*   **Functions:** `fn_{acao}_{alvo}` (ex: `fn_generate_uuid_v7`, `fn_update_timestamp`).
*   **ENUMs:** `type_{contexto}_{status}` (ex: `type_order_status`, `type_ledger_entry`).
*   **Views:** `vw_{nome_logico}` (ex: `vw_daily_revenue`).
*   **Materialized Views:** `mvw_{nome_logico}` (ex: `mvw_creator_monthly_stats`).

---

## 2. Tipos Obrigatórios (Data Types)

O PostgreSQL é rico. Restringiremos os tipos para garantir performance e previsibilidade em larga escala.

*   **`UUID` (v7 obrigatório):** Usado para todas as chaves primárias de domínio expostas (Members, Orders, Creators). O V7 garante ordenação cronológica e impede fragmentação (Page Splits) nos índices.
*   **`BIGINT`:**
    1.  Chaves primárias transacionais geradas com `GENERATED ALWAYS AS IDENTITY` (Ledger, Events, Jobs).
    2.  **Valores Monetários:** Dinheiro na plataforma é SEMPRE representado em centavos (`unit_amount_cents`, `balance`). O uso de FLOAT/DOUBLE para dinheiro é crime de responsabilidade e causará quebra de build.
*   **`TIMESTAMPTZ`:** Todos os campos de data/hora sem exceção. O banco armazena em UTC fisicamente, e o TZ indica ao cliente como parsear. É proibido usar `TIMESTAMP` (sem TZ).
*   **`TEXT`:** Padrão para strings de tamanho não determinístico (Bios, Descrições, URLs, Textos de Posts).
*   **`VARCHAR(n)`:** Restrito a domínios fixos (ex: `document_cpf VARCHAR(11)`, `country_code VARCHAR(2)`).
*   **`JSONB`:** Exclusivo para *Payloads* (Eventos), metadados flexíveis (`metadata` do criador) e Rules Engines. Proibido para modelar relacionamentos que deveriam ser tabelas 1:N. Jamais usar o tipo `JSON` (texto plano).
*   **`BOOLEAN`:** Flags binárias lógicas (ex: `is_active`).
*   **`NUMERIC`:** Permitido estritamente para multiplicadores exatos (ex: taxas de comissão `commission_rate NUMERIC(5,4)` como 0.0500 para 5%). Jamais para saldos absolutos.
*   **`BYTEA`:** Proibido na Sprint 1. Nenhum arquivo/binário será salvo no banco. Usar AWS S3 + campo `file_url` (`TEXT`).

---

## 3. Convenção de Timestamps

Toda tabela de domínio principal terá timestamps de ciclo de vida. O motor (Trigger) cuidará da atualização.

*   `created_at`: Preenchido por `DEFAULT now()` em todo INSERT. É imutável.
*   `updated_at`: Obrigatório em tabelas mutáveis. Atualizado automaticamente por trigger genérica (`fn_update_timestamp`).
*   `deleted_at`: Usado estritamente onde *Soft-Delete* for obrigatório pelo negócio (Membros, Produtos).
*   `processed_at` / `completed_at`: Padrão para controle de fluxo em filas (Outbox, Jobs).
*   `expires_at`: Padrão para expiração (Sessões JWT, Promoções).
*   `published_at`: Padrão para visibilidade de conteúdo (Posts).

---

## 4. Convenção de Índices

Índices devem ser criados sob demanda estratégica, pois atrasam os INSERTs (write penalty).

*   **BTREE:** Padrão ouro. Obrigatório em TODAS as Foreign Keys para evitar locks completos de tabela ao deletar/atualizar a tabela mãe.
*   **GIN:** Obrigatório nas colunas `JSONB` apenas se precisarmos buscar chaves profundas em relatórios.
*   **BRIN (Block Range Index):** Obrigatório em tabelas massivas de tempo-série (`tracking.events_raw`). Índices B-Tree nesta tabela causariam exaustão de disco.
*   **HASH:** Raramente usado. Somente para URLs puras ou tokens gigantes onde checagens de igualdade ultra-rápidas (`=`) são a única query possível.
*   **Partial Index:** Obrigatório em booleanos ou filas lógicas. Ex: `CREATE INDEX ... ON system.outbox_events (id) WHERE processed_at IS NULL`.
*   **Expression Index:** Usado para garantir case-insensitivity onde CITEXT for desnecessário. Ex: `CREATE UNIQUE INDEX ... ON auth.users (lower(email))`.
*   **Unique Index:** Preferencialmente declarado via Constraint (`UNIQUE`), gerando o índice B-Tree implicitamente.

---

## 5. Convenção de Foreign Keys

As FKs salvam o negócio de furos de consistência. Seguem o estrito alinhamento do *Physical Design*.

*   **ON DELETE RESTRICT (Padrão):** Aplicado por padrão a 90% do banco. Se um afiliado possui membros recrutados, ele não pode ser deletado. O banco deve travar e gritar um erro ACID.
*   **ON DELETE CASCADE (Exceção Estrita):** Permitido apenas em *Strong Composition*. Onde a entidade dependente perde o sentido sem a entidade pai. Ex: `auth.sessions` apaga se `auth.users` for apagado; `commerce.order_items` apaga se `commerce.orders` rodar rollback.
*   **ON DELETE SET NULL:** Único uso catalogado: Auto-referência em `core.members` (Gestor/Afiliado originador expurgado, o membro filho fica sem dono).
*   **ON UPDATE (Cascade/Restrict):** Não declarado/Omitido, pois chaves primárias imutáveis (UUID/BigInt) jamais sofrerão update lógico.
*   **NOT DEFERRABLE:** Padrão absoluto. As verificações de integridade ocorrem no ato do statement (statement-level), falhando rápido, não esperando o COMMIT da transação.

---

## 6. Convenção de Constraints (Guardiões Locais)

*   **NOT NULL:** Regra primária. Nenhuma coluna admitirá NULL a menos que seja um dado opcional explicitly validado pelo Domínio.
*   **DEFAULT:** O banco ditará padrões triviais (`DEFAULT false` para flags, `DEFAULT now()` para datas), tirando a carga da aplicação.
*   **CHECK:** Regras de negócio físicas e inquebráveis.
    *   `ck_wallets_balance (available_balance >= 0)`.
    *   `ck_products_type (type IN ('subscription', 'pack', 'ppv'))`.
*   **UNIQUE:** Prevenção de duplicidade em campos chaves (`email`, `document_cpf`).
*   **EXCLUDE:** Usado (se necessário) para evitar sobreposição de períodos em assinaturas (não permitir que o membro tenha 2 assinaturas ativas na mesma criadora cobrindo a mesma janela de data).

---

## 7. Convenção de ENUMs

*   **Nomenclatura:** Iniciar com `type_` (ex: `type_order_status`, `type_transaction_status`).
*   **Onde usar:** Campos com menos de 10 estados mutáveis lógicos, controlados 100% pelo código da aplicação, que raramente mudam (ex: "pending", "paid", "failed", "refunded").
*   **Onde proibir:** Não usar ENUM para tabelas dinâmicas (ex: Categorias de Produto, Tipos de Assinatura, Nomes de Planos). Isso deve ser uma Tabela Dicionário.

---

## 8. Convenção de Functions (Funções Nativas)

*   **Funções de UUID (`fn_generate_uuid_v7`):** Como o PG16 não traz o `uuid_generate_v7()` nativamente ativo sem dependência compilada complexa, a implementação criará uma função SQL/PLpgSQL purista e hiper-rápida baseada na v7 RFC 9562, que será injetada como DEFAULT em PKs.
*   **Funções de Trigger (`fn_update_timestamp`):** Função unificada que pega o `NEW.updated_at = now()` e devolve `NEW`. Reutilizada por centenas de tabelas.
*   **Business Logic Ban (Regra do ARB):** Funções e Procedures PL/pgSQL estão **PROIBIDAS** de encadear lógica de negócio financeira (ex: Função que atualiza o Ledger e soma na Wallet via query imperativa no banco). Toda lógica de negócio, inclusive geração do Evento para o Outbox, mora na *Camada de Domínio (Aplicação)*, e o Banco garante integridade e persistência.

---

## 9. Convenção de Triggers

O ARB Audit derrubou o uso abusivo de triggers para evitar Deadlocks.
*   **Permitidas:**
    *   Sincronização de campos de metadados (`updated_at`), exceto em tabelas de hot-spot transacional altíssimo.
    *   Proteção contra modificação (`trg_prevent_ledger_update` lançando Exception caso alguém tente dar UPDATE no Ledger).
*   **Estritamente Proibidas:**
    *   Triggers de transbordamento de módulo (Ex: Trigger no schema `commerce` alterando `finance.wallets`).
    *   Triggers síncronas de totalização (Ex: Soma de carrinho automatizada).
*   **Isenção Explicita (Hot-Spots):** A tabela `finance.wallets` NÃO deve usar triggers para atualização de `updated_at`. Isso poupa CPU do banco durante transações massivas com *Pessimistic Locking* limitando o Row Lock Time (a atualização será feita de forma explícita na própria query).

---

## 10. Convenção de Particionamento (Declarative Partitioning)

As migrações deverão configurar as tabelas primárias como PARTITIONED TABLES.
*   **Atenção Crítica (Chaves Primárias):** Devido à arquitetura do PostgreSQL, tabelas particionadas exigem que a chave primária (e qualquer constraint Unique) incorpore a coluna de partição. Portanto, a PK dessas tabelas será obrigatoriamente **Composta (Composite PK)** contendo o `id` e o `created_at`.
*   **`finance.ledger` (RANGE Mensal):** Partição baseada no `created_at`. PK: `(id, created_at)`.
*   **`tracking.events_raw` (RANGE Mensal):** Partição baseada no `created_at`. PK: `(id, created_at)`.
*   **`system.outbox_events` (RANGE Diário):** Partição baseada no `created_at`. PK: `(id, created_at)`. Necessário para implementar a tática *Partitioned Outbox Drop* (Dropar a partição inteira diária ao invés de usar Vacuum, zerando o Table Bloat de tuplas mortas O(1)).
*   **Convenção DDL:** O script DDL deve possuir uma query que auto-gera as partições dos próximos 12 meses, evitando que o banco falhe por falta de partição de recepção.

---

## 11. Convenção de Performance Físico-Lógica

*   **Fillfactor:** Tabelas de alta mutação local sem indexação da coluna mutável (Ex: `finance.wallets` apenas `available_balance` mudando, e `commerce.subscriptions` renovando) receberão DDL explícito `WITH (FILLFACTOR = 85)` para engatilhar os **HOT Updates**, poupando rebuild de índices.
*   **Autovacuum:** DDL no `system.outbox_events` receberá `autovacuum_vacuum_scale_factor = 0.02` e `autovacuum_analyze_scale_factor = 0.01` para expurgar tuplas processadas instântaneamente, evitando inchaço da fila de mensagens.

---

## 12. Convenção de Segurança

*   **Schemas Limits:** Um módulo não pode acessar livremente dados privados do outro sem passar por permissões granulares no nível do Pooler. Mas para Sprint 1, a regra é de Logical Boundaries (O Código fonte respeita).
*   **Search Path:** Toda migration começará garantindo que os objetos estão sendo criados explicitamente no schema desejado. Ex: `CREATE TABLE finance.ledger` ao invés de usar `SET search_path = finance`.
*   **RLS (Row Level Security):** Desativado para a aplicação por padrão (Auth e Multi-tenant garantidos no backend/JWT). O único local onde ativaremos RLS será no Ledger, com Política FORCING deny para comandos de DELETE e UPDATE globais para a role da API.

---

## 13. Convenção de Migrations

O SQL gerado simulará ferramentas como Flyway ou Goose.
*   **Formato do Arquivo:** `V{numero}__titulo_da_migration.sql` (ex: `V001__init_schemas.sql`).
*   **Idempotência Obrigatória:** Usar sem ressalvas os modificadores `IF NOT EXISTS` na criação de schemas, tabelas, índices e tipos para garantir segurança de deploy.
*   **Rollback (Down Scripts):** Cada migration deve ter teoricamente a sua reversão documentada (se necessário, será gerado separadamente nos outputs).
*   **Ordem:** Deve refletir 100% a Ordem de Criação DDL Topológica estipulada no *Entity Relationship Model v1.0*. (Fundação -> Auth -> Core -> ... -> Ledger).

---

## 14. Auditoria de Conformidade (Blueprint x ERD x Spec)

*   **Check UUIDv7:** Aprovado em todos os documentos (Physical e ERD apontam V7, Spec descreve criação da função).
*   **Check BigInt Money:** Aprovado (Physical e ERD definem Ledger com BigInt).
*   **Check Trigger Ban:** Aprovado (ARB determinou retirada de trigger de Deadlock das wallets, Spec bloqueia trigger de business logic).
*   **Check Transactions/Events:** Aprovado (Outbox garantido, `events_raw` BRIN indexado).
*   **Check Identity Resolution:** Aprovado (Tabelas de `tracking` sem FK rigorosa para logs).

**Veredicto da Auditoria:** Nenhuma divergência estrutural, tipográfica ou arquitetural detectada. A Constituição de Implementação está **100% Sincronizada** com o Architecture Freeze v1.0.

---
*Este é o documento final da cadeia de planejamento. Qualquer instrução solicitada a partir de agora se materializará em código SQL aplicável em produção.*