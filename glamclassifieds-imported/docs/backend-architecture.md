# Backend Architecture Blueprint (Enterprise Standard)

**Autor:** Lead Backend Architect (Ex-Stripe/Shopify Staff Engineer)
**Foco:** Engenharia de Software, Resiliência, Escalabilidade e Governança de Código
**Status:** Aprovado para Implementação

Este documento define a fundação de engenharia de software da plataforma. Ele atua como a única fonte da verdade para decisões estruturais do backend. O objetivo é garantir que 10 ou 100 desenvolvedores possam trabalhar simultaneamente no código sem corromper as fronteiras de domínio, sem ferir a integridade do banco de dados (V001-V012) e mantendo a alta disponibilidade.

---

## 1. Visão Arquitetural & Stack Tecnológica

Optamos por um **Monolito Modular (Modular Monolith)**. Microserviços prematuros geram overhead de rede e transações distribuídas (Sagas) desnecessárias. O Monolito Modular oferece a velocidade de desenvolvimento de um monolito com o encapsulamento estrito de microserviços.

*   **Linguagem:** TypeScript (Strict Mode, ES2022+).
*   **Framework:** NestJS ou Fastify + TSyringe (Foco em Injeção de Dependência e Performance).
*   **Banco de Dados Primário:** PostgreSQL 16 (Interação via Query Builder como Kysely ou Knex para máxima performance; ORMs pesados como TypeORM são proibidos para inserções massivas).
*   **Cache & Fila Efêmera:** Redis (Cluster Mode).
*   **Mensageria / Eventos:** AWS SQS / Kafka (para assincronicidade) e EventEmitter (em memória, inter-módulos).
*   **Armazenamento de Mídia:** AWS S3 (Standard & Glacier).
*   **Processamento de Mídia:** AWS MediaConvert & AWS Lambda.

---

## 2. Estrutura de Diretórios e Fronteiras de Domínio

A base de código refletirá a arquitetura do banco de dados (Domain-Driven Design). É estritamente proibido um módulo importar o `Repository` de outro módulo. A comunicação inter-módulo ocorre apenas através de **Services (Contratos/Interfaces)** ou **Event Bus**.

```text
src/
├── app.ts                  # Entrypoint e inicialização do servidor HTTP
├── shared/                 # Código utilitário agnóstico de domínio
│   ├── logger/             # Configuração do Pino (Structured Logging)
│   ├── observability/      # OpenTelemetry, Metrics, Tracing
│   ├── errors/             # Classes de erro globais (DomainError, ValidationError)
│   ├── database/           # Conexão PG, Unit of Work / Transaction Manager
│   └── event-bus/          # Barramento de eventos em memória
└── modules/
    ├── auth/               # Autenticação, JWT, Sessões
    ├── core/               # Identidades, Membros, ACL
    ├── classifieds/        # Anúncios, Categorias, Mídia de Classificados
    ├── creators/           # (schema 'only') Perfis de Criadores, Posts
    ├── commerce/           # Catálogo, Pedidos, Assinaturas
    ├── finance/            # Ledger, Wallets, Transactions, Gateways
    ├── tracking/           # Eventos Raw, CAPI, GTM
    └── system/             # Configurações globais, Workers de Outbox
```

---

## 3. Padrões de Componentes (Hexagonal / Clean Architecture)

Cada módulo (ex: `commerce`) internamente possuirá as seguintes camadas lógicas:

### 3.1. Controllers (Transport Layer)
*   Responsáveis unicamente por receber a requisição (HTTP REST ou gRPC), validar o Payload (DTO via Zod/Joi), extrair a sessão e delegar para o Service. 
*   **Proibido:** Ter lógica de negócios ou queries SQL no Controller.

### 3.2. Services (Use Cases / Business Logic)
*   O coração da plataforma. Orquestra a lógica de negócios.
*   **Transactionality:** O Service é responsável por abrir o *Unit of Work* (`TransactionManager`). Se ele precisa inserir um Pedido (Commerce) e debitar uma Wallet (Finance), ele orquestra as chamadas aos repositórios ou aos contratos expostos de outros módulos, passando o escopo da transação (TX) atual para garantir o `COMMIT` atômico.

### 3.3. Repositories (Data Access Layer)
*   Responsáveis exclusivos por tocar no PostgreSQL e Redis.
*   Retornam Entidades de Domínio puras, não *Rows* de banco de dados.
*   Embutem as lógicas de paginação e filtragem otimizada.

### 3.4. Dependency Injection (DI)
*   Todo Controller e Service deve receber suas dependências via construtor (IoC).
*   Isso torna a plataforma 100% testável com Mocks (Testes Unitários) sem precisar subir o PostgreSQL.

### 3.5. Contratos entre Módulos
*   Se `commerce` precisa saber se o usuário tem saldo, ele não faz uma query na tabela `wallets`. Ele importa a interface `IFinanceService` e chama `financeService.checkBalance(memberId)`. Isso isola o esquema do banco de dados e permite que o módulo `finance` mude internamente sem quebrar o `commerce`.

---

## 4. Comunicação e Processamento Assíncrono

### 4.1. Event Bus (Síncrono / Em Memória)
*   Utilizado para orquestração leve. Ex: Quando `commerce` emite `order.paid` internamente, o `creators` escuta esse evento e libera o post, tudo dentro da **mesma requisição HTTP** e mesma Transação ACID.

### 4.2. Outbox Pattern & Workers (Garantia de Entrega Distribuída)
*   Para integrações externas (Email, Webhooks, CAPI).
*   O Service insere a ação na tabela `system.outbox_events` na *mesma transação* do banco. 
*   Um **Worker Background** processa essa tabela e envia para a AWS SQS, garantindo que nenhum evento de negócio seja perdido caso o servidor Node.js reinicie subitamente.

### 4.3. Filas, Retries e DLQ (Dead Letter Queue)
*   Trabalhos pesados consumidos da SQS terão política estrita de:
    *   **Retry:** Exponential Backoff (Tenta com 2s, depois 4s, depois 8s).
    *   **DLQ:** Após 5 falhas, o evento cai na DLQ para inspeção manual.
    *   **Idempotência:** Todo Worker checa a existência da chave de idempotência (via Redis ou banco) antes de processar, impedindo processamento duplo se a SQS entregar a mensagem duas vezes.

---

## 5. Integrações Críticas

### 5.1. Upload e Processamento de Mídia
*   **Proibido:** Fazer upload de MP4 diretamente pelo Node.js. Isso bloqueia a Event Loop e consome toda a RAM.
*   **Fluxo:** O Client pede um **S3 Presigned URL** ao Backend. O Client upa direto no S3 da AWS. O S3 avisa a AWS Lambda, que transcodifica (AWS MediaConvert). A Lambda avisa o Backend (Webhook) que atualiza o `only.post_media`.

### 5.2. Webhooks e Gateways de Pagamento (Stripe, Asaas)
*   Webhooks expõem rotas públicas blindadas por verificação de assinatura (HMAC).
*   Processam-se de forma assíncrona: O webhook bate no Node.js, é jogado no Redis/SQS, e a API devolve HTTP 200 pro Gateway.
*   O Worker consome o payload e invoca o `TransactionManager`. A idempotência é garantida no nível físico pelos índices únicos (`gateway_transaction_id`) construídos na V010.

---

## 6. Segurança: Autenticação, Autorização e ACL

### 6.1. Autenticação (AuthN)
*   Stateless via **JWT (JSON Web Tokens)** assinados assimetricamente (RS256) com short-lived TTL (15 minutos), mitigando dano por token vazado. 
*   O Refresh Token é *Stateful*, armazenado em `auth.sessions` (com suporte a revogação de dispositivos).

### 6.2. Autorização e ACL (AuthZ)
*   Executada através de Middlewares/Guards aplicados nos Controllers.
*   **Controle de Acesso de Posts (PPV):** O Controller `PostsController` intercepta o request, invoca `CreatorsService.checkAccess(memberId, postId)`, que faz o lookup supersônico na tabela `only.post_access`. Sem acesso = 403 Forbidden imediato, sem consumir I/O desnecessário buscando a mídia.

---

## 7. Resiliência Operacional

### 7.1. Tratamento de Erros Global (Global Exception Filter)
*   As classes de domínio nunca retornam HTTP *Status Codes*. Elas estouram erros tipados (`PaymentDeclinedError`, `UserNotFoundError`).
*   Um middleware intercepta esses erros no limite (Edge) do Controller e converte para HTTP 400, 403, 404 de forma padronizada, escondendo Stack Traces do usuário e enviando os detalhes para o O11y.

### 7.2. Circuit Breakers
*   Implementados (via *Opossum* ou similar) em todas as integrações de terceiros (Stripe, CAPI, GTM).
*   Se a API do Stripe cair, o Circuit Breaker "abre", cortando os requests imediatamente por 30 segundos, devolvendo erro amigável ao cliente e salvando as threads do Node.js do estrangulamento por Timeout.

---

## 8. Observabilidade (O11y)

Não existe "log.info('caiu aqui')". O sistema adota a tríade da observabilidade enterprise:

### 8.1. Logs Estruturados (Pino)
*   Logs formatados em JSON puros. Devem conter `trace_id`, `member_id` e `context`. Exportados via FluentBit para o ElasticSearch/Datadog.

### 8.2. Tracing Distribuído (OpenTelemetry - OTel)
*   Todo request ganha um `trace_id` no Middleware inicial. Esse ID é propagado para chamadas internas de serviço, queries de banco e requests HTTP externos. Permite visualizar o funil exato do Gargalo de Performance (Ex: "O request demorou 1.2s porque a query de validação de ACL demorou 1.1s").

### 8.3. Métricas (Prometheus)
*   Instrumentação nos Controllers e Workers para capturar RED (Rate, Errors, Duration).
*   Dashboards de alerta P0 configurados para: Taxa de Sucesso de Checkout, Latência do Webhook, Crescimento de Outbox Lag, Volume de Chargebacks.

---
*Veredito: Com esta arquitetura de software declarada e blindada pelos contratos, o time de engenharia está habilitado a escalar a produção do código simultaneamente, com riscos minimizados de débito técnico arquitetural.*