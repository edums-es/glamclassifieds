# Platform Domain Model (Arquitetura e Engenharia de Software)

Este documento serve como a **Planta Arquitetural Oficial** da plataforma. Define os limites de contexto (Bounded Contexts), responsabilidades, entidades, comunicação assíncrona (Eventos) e regras de domínio em uma arquitetura **Modular Monolith**.

Nenhum módulo deve acessar o banco de dados de outro módulo. Toda comunicação entre domínios deve ser feita através de Contratos (APIs internas/Serviços) ou Eventos (Pub/Sub).

---

## 1. Catálogo de Módulos (Bounded Contexts)

### 1.1. Core & Identity
*   **Auth (Autenticação)**
    *   *Objetivo:* Garantir a identidade e o acesso seguro.
    *   *Entidades:* `UserCredential`, `Session`, `MagicLink`.
    *   *Publica:* `UserRegistered`, `UserLoggedIn`, `UserLoggedOut`, `PasswordResetRequested`.
    *   *Consome:* Nenhum.
    *   *Dependências:* Nenhuma. Módulo base.
*   **Members (Membros/Usuários Base)**
    *   *Objetivo:* Gerenciar os dados demográficos e perfil público dos usuários.
    *   *Entidades:* `MemberProfile`, `UserPreference`.
    *   *Publica:* `MemberProfileUpdated`.
    *   *Consome:* `UserRegistered` (para criar o perfil base).
*   **Permissions (Controle de Acesso)**
    *   *Objetivo:* Gerenciar RBAC (Role-Based Access Control) e permissões de sistema.
    *   *Entidades:* `Role`, `Permission`, `RoleAssignment`.

### 1.2. Content & Creator Economy
*   **Classifieds (Classificados)**
    *   *Objetivo:* Gerenciar os anúncios públicos gratuitos/pagos originais.
    *   *Entidades:* `ClassifiedAd`, `AdCategory`, `Location`.
    *   *Publica:* `ClassifiedCreated`, `ClassifiedApproved`.
*   **Only (Conteúdo Exclusivo)**
    *   *Objetivo:* Gerenciar a operação dos criadores de conteúdo (Painel, Posts).
    *   *Entidades:* `CreatorProfile`, `Post`, `Tier`.
    *   *Publica:* `CreatorOnboarded`, `PostCreated`, `PostDeleted`.
    *   *Consome:* `SubscriptionCreated` (para liberar acesso ao conteúdo).
*   **Media (Mídia e Storage)**
    *   *Objetivo:* Processar, encodar (blur), armazenar e servir imagens/vídeos.
    *   *Entidades:* `MediaAsset`, `EncodingJob`.
    *   *Publica:* `MediaUploaded`, `MediaProcessingCompleted`, `MediaProcessingFailed`.
    *   *Consome:* `PostCreated` (para iniciar o blur/encode do asset associado).

### 1.3. Sales & Commerce
*   **Products (Catálogo)**
    *   *Objetivo:* Centralizar tudo que pode ser vendido (Assinaturas, PPV, Packs, Destaques de Classificados).
    *   *Entidades:* `Product`, `PriceBook`.
*   **Orders (Pedidos)**
    *   *Objetivo:* Gerenciar a intenção de compra (Checkout).
    *   *Entidades:* `Order`, `OrderItem`.
    *   *Publica:* `CheckoutStarted`, `OrderCreated`, `OrderCanceled`.
    *   *Dependências:* Comunica-se com *Products* para validar preços.

### 1.4. Financial Engine
*   **Payments (Pagamentos)**
    *   *Objetivo:* Conversar com gateways externos (Stripe, Pagar.me, Pix).
    *   *Entidades:* `PaymentTransaction`, `PaymentMethod`.
    *   *Publica:* `PaymentApproved`, `PaymentFailed`, `PaymentRefunded`, `ChargebackReceived`.
    *   *Consome:* `OrderCreated` (para cobrar).
*   **Finance (Orquestração Financeira)**
    *   *Objetivo:* Traduzir um pagamento aprovado na liberação do serviço (Assinaturas, PPVs).
    *   *Entidades:* `Invoice`, `Subscription`.
    *   *Publica:* `SubscriptionCreated`, `SubscriptionRenewed`, `SubscriptionCanceled`, `PpvPurchased`.
    *   *Consome:* `PaymentApproved`, `PaymentFailed`.
*   **Ledger (Livro-Razão Imutável)**
    *   *Objetivo:* Registrar toda movimentação financeira em dupla-entrada. Prova matemática do dinheiro.
    *   *Entidades:* `LedgerEntry`, `LedgerAccount`.
    *   *Publica:* `LedgerRecorded`.
    *   *Consome:* `CommissionCalculated`, `PaymentApproved` (para registrar as entradas).
*   **Wallet (Carteiras e Saques)**
    *   *Objetivo:* Projetar saldos (caches do Ledger) e gerenciar saques.
    *   *Entidades:* `Wallet`, `WithdrawalRequest`.
    *   *Publica:* `WithdrawalRequested`, `WithdrawalApproved`.
    *   *Consome:* `LedgerRecorded` (para atualizar o saldo projetado).
*   **Commissions (Motor de Comissionamento)**
    *   *Objetivo:* Calcular quem ganha o quê baseado em regras configuráveis.
    *   *Entidades:* `CommissionRule`, `CommissionSplit`.
    *   *Publica:* `CommissionCalculated`.
    *   *Consome:* `TransactionCompleted` (emitido pelo Finance).

### 1.5. Growth & Retention (Revenue-First Core)
*   **Affiliates (Atribuição)**
    *   *Objetivo:* Rastrear links, cliques e definir o "dono" da venda.
    *   *Entidades:* `AffiliateProfile`, `ReferralLink`, `AttributionLog`.
    *   *Publica:* `AffiliateAssigned`, `AffiliateClicked`.
*   **CRM (Customer Relationship Management)**
    *   *Objetivo:* Manter a visão 360º de LTV, estados do cliente (Jornada) e métricas individuais.
    *   *Entidades:* `CustomerProfile`, `LifecycleTransition`.
    *   *Publica:* `CustomerBecameVip`, `CustomerChurned`, `CustomerReactivated`.
    *   *Consome:* Todos os eventos de Finance, Orders e Analytics.
*   **Analytics (Data Ingestion)**
    *   *Objetivo:* Receber o volume massivo de eventos brutos para BI.
    *   *Entidades:* `EventLog`, `PageviewEvent`, `InteractionEvent`.
    *   *Consome:* TUDO na plataforma.
*   **Recovery (Recuperação)**
    *   *Objetivo:* Executar a máquina de automação para salvar carrinhos e renovações falhas.
    *   *Entidades:* `RecoveryCampaign`, `RecoveryTask`.
    *   *Publica:* `RecoveryStarted`, `RecoveryCompleted`, `RecoveryFailed`.
    *   *Consome:* `CheckoutAbandoned`, `PaymentFailed`.
*   **Marketing & Sales Engine**
    *   *Objetivo:* Cupons, Descontos dinâmicos e Campanhas ativas.
    *   *Entidades:* `Campaign`, `Coupon`.
*   **Notifications (Comunicação)**
    *   *Objetivo:* Entregar E-mails, SMS, Webhooks e Push.
    *   *Entidades:* `NotificationTemplate`, `NotificationDispatch`.
    *   *Consome:* `RecoveryStarted` (para enviar e-mail de abandono), etc.

### 1.6. Foundation
*   **Settings (Configuração Global)**
    *   *Objetivo:* Evitar *hardcode*. Gestão de variáveis de ambiente do negócio e Feature Flags.
    *   *Entidades:* `SystemSetting`, `FeatureFlag`.
*   **Audit (Auditoria e Compliance)**
    *   *Objetivo:* Logar quem alterou o quê (preços, comissões, aprovação de saques).
    *   *Entidades:* `AuditLog`.
*   **Administration**
    *   *Objetivo:* Painéis de gestão interna consumindo APIs dos outros módulos.
    *   *Não possui banco próprio, age como um API Gateway / BFF (Backend for Frontend) administrativo.*

---

## 2. Entity Ownership (Quem é dono do quê?)

Para evitar corrupção de domínio, cada entidade pertence **exclusivamente** a um módulo. Se o *CRM* precisar saber o status de uma *Subscription*, ele faz isso ouvindo eventos do *Finance* ou consultando uma API interna do *Finance*, mas nunca lendo a tabela `subscriptions` do *Finance* diretamente.

*   `Member` -> pertence a **Members**
*   `Creator` -> pertence a **Only**
*   `Affiliate` -> pertence a **Affiliates**
*   `Product`, `PriceBook` -> pertence a **Products**
*   `Order`, `OrderItem` -> pertence a **Orders**
*   `Subscription`, `Invoice` -> pertence a **Finance**
*   `LedgerEntry`, `LedgerAccount` -> pertence a **Ledger**
*   `Wallet`, `WithdrawalRequest` -> pertence a **Wallet**
*   `CommissionRule` -> pertence a **Commissions**
*   `CustomerProfile` -> pertence a **CRM**
*   `EventLog` -> pertence a **Analytics**
*   `MediaAsset` -> pertence a **Media**

---

## 3. Modelo de Responsabilidade (Ownership Model de Negócio)

Tudo na plataforma tem um "Responsável de Negócio" (Owner):
*   **Cliente (Member):** Possui um *Attribution Owner* (O Atendente que o trouxe, ou *null* se for Orgânico).
*   **Criadora (Modelo):** Pode possuir um *Manager Owner* (Agência/Assessor) que gerencia sua conta e recebe uma fatia automática direto no Split.
*   **Wallet:** Possui um *Wallet Owner* (Pode ser Member, Creator, Affiliate ou System/Platform).
*   **Recovery Task:** Possui um *Agent Owner* (Atendente associado à recuperação manual).
*   **Campanha de Marketing:** Possui um *Admin Owner* (Quem criou a regra).

---

## 4. Mapa de Comunicação e Fluxos Core

### Fluxo 1: A Compra de uma Assinatura via Afiliado
1.  **Analytics:** Publica `CheckoutStarted`.
2.  **Orders:** Cria o `Order` e publica `OrderCreated`.
3.  **Payments:** Escuta `OrderCreated`, fala com Gateway e publica `PaymentApproved`.
4.  **Finance:** Escuta `PaymentApproved`, cria a `Subscription` e publica `SubscriptionCreated` e `TransactionCompleted`.
5.  **Only:** Escuta `SubscriptionCreated` e libera o acesso do usuário ao conteúdo.
6.  **Commissions:** Escuta `TransactionCompleted`. Lê no módulo *Affiliates* que a venda tem atribuição. Calcula a divisão (70% Modelo, 15% Atendente, 15% Plataforma) e publica `CommissionCalculated`.
7.  **Ledger:** Escuta `CommissionCalculated` e grava 4 registros imutáveis (débitos e créditos reais). Publica `LedgerRecorded`.
8.  **Wallet:** Escuta `LedgerRecorded` e atualiza o saldo da modelo e do atendente na tela.
9.  **CRM:** Escuta `SubscriptionCreated` e atualiza o `CustomerProfile` para o status `Active Subscriber`, aumentando o LTV do cliente e do Atendente.

### Fluxo 2: Recuperação de Carrinho Abandonada
1.  **Recovery:** Um *Cron* ou *Redis TTL* detecta que um `CheckoutStarted` está orfão há 30 minutos. Publica `CheckoutAbandoned`.
2.  **Recovery:** Cria a `RecoveryTask` e publica `RecoveryActionTriggered`.
3.  **Notifications:** Envia E-mail de lembrete com link mágico contendo Token de Atribuição (Origem = Recovery).
4.  *(Se o cliente comprar, o fluxo de venda ocorre)* -> No passo de **Commissions**, a regra lida será: *Se Origin == Recovery, Comissão Atendente = 8%*.

---

## 5. Catálogo Global de Eventos

Este é o dicionário central de reatividade da plataforma.

**Auth & Session**
*   `UserRegistered`, `UserLoggedIn`, `UserLoggedOut`, `SessionHeartbeat`

**Navigation & Analytics**
*   `ProfileViewed`, `MediaPreviewed`, `MediaOpened`, `VideoPlayed`, `VideoCompleted`, `ButtonClicked`

**Commerce & Orders**
*   `CheckoutStarted`, `CheckoutAbandoned`, `OrderCreated`, `OrderCanceled`, `CouponApplied`

**Payments & Finance**
*   `PaymentApproved`, `PaymentFailed`, `PaymentRefunded`, `ChargebackReceived`
*   `SubscriptionCreated`, `SubscriptionRenewed`, `SubscriptionCanceled`, `SubscriptionPaymentFailed`
*   `PpvPurchased`, `PackPurchased`, `TipSent`

**Distribution & Ledgers**
*   `AffiliateClicked`, `AffiliateAssigned`
*   `CommissionCalculated`, `CommissionSplitApplied`
*   `LedgerRecorded`
*   `WalletCredited`, `WalletDebited`, `WithdrawalRequested`, `WithdrawalApproved`, `WithdrawalRejected`

**CRM & Recovery**
*   `CustomerStageChanged`, `CustomerBecameVip`, `CustomerChurned`, `CustomerReactivated`
*   `RecoveryStarted`, `RecoveryCompleted`, `RecoveryFailed`

**Content & Moderation**
*   `CreatorOnboarded`, `CreatorApproved`, `CreatorRejected`
*   `PostCreated`, `PostFlagged`, `PostDeleted`
*   `MediaUploaded`, `MediaProcessingCompleted`

**System**
*   `FeatureEnabled`, `FeatureDisabled`, `SystemSettingChanged`, `AuditLogCreated`

---

## 6. Configurações Globais (Settings Module)

O sistema deve ter uma interface administrativa para configurar as regras do negócio sem deploy de código. Chaves principais:

### 6.1. Financeiras & Comerciais
*   `DEFAULT_PLATFORM_FEE_PCT` (ex: 20%)
*   `HOLD_FUNDS_DAYS_CC` (Hold preventivo contra chargeback em cartão de crédito, ex: 14 dias)
*   `HOLD_FUNDS_DAYS_PIX` (Hold em PIX, ex: 1 dia)
*   `MINIMUM_WITHDRAWAL_AMOUNT` (ex: R$ 100,00)

### 6.2. Atribuição & Recovery
*   `AFFILIATE_COOKIE_TTL_DAYS` (ex: 30 dias)
*   `AFFILIATE_STICKY_RECURRING` (boolean: true/false se a recorrência continua pagando o afiliado indefinidamente)
*   `CART_ABANDONMENT_TIMEOUT_MINUTES` (ex: 30)
*   `RECOVERY_GRACE_PERIOD_DAYS` (ex: 3)

### 6.3. Limites e Mídia
*   `MAX_UPLOAD_SIZE_MB` (ex: 2048)
*   `MAX_PHOTOS_PER_POST` (ex: 15)
*   `SESSION_IDLE_TIMEOUT_MINUTES` (ex: 60)

### 6.4. Feature Flags
*   `FF_ENABLE_TIPS` (true/false)
*   `FF_ENABLE_AFFILIATE_REGISTRATION` (true/false)
*   `FF_MAINTENANCE_MODE` (true/false)

---
*Fim do Documento Estrutural. A próxima fase técnica consistirá em criar a modelagem Relacional e NoSQL baseada nesses domínios.*