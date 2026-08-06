# Sprint 1 Freeze

## 1. Escopo da Sprint 1
**Implementado:**
- Fundação do projeto (Node.js + NestJS + Fastify).
- Configuração estrita do TypeScript (ES2022, NodeNext, Strict Mode).
- Qualidade de código e formatação (ESLint Flat Config, Prettier).
- Hooks de Git e CI local (Husky, lint-staged).
- Infraestrutura local conteinerizada (Docker, Docker Compose com PostgreSQL 16 e Redis 7).
- Configuração do pipeline de testes unitários e e2e (Vitest, Testcontainers).
- Árvore de diretórios estruturada sob os princípios de Domain-Driven Design (DDD).

**NÃO faz parte da Sprint 1:**
- Lógica de negócios (Controllers, Services, Repositories).
- Schemas de banco de dados físicos (gerenciados via migrations externas validadas).
- Autenticação e Autorização.
- Regras de domínio e APIs públicas.

## 2. Stack Oficial (Congelada)
- **Runtime:** Node.js 22 LTS
- **Framework:** NestJS 11 + Fastify
- **Banco de Dados Relacional:** PostgreSQL 16
- **Cache & Fila Efêmera:** Redis 7
- **Conteinerização:** Docker & Docker Compose
- **Linguagem:** TypeScript 5.x
- **Testes:** Vitest + Testcontainers
- **Data Access:** Kysely (Query Builder estrito)
- **Validação:** Zod
- **Observabilidade:** OpenTelemetry (Planejado via infra base)
- **Mensageria:** AWS SQS (Mockado localmente)
- **Armazenamento:** AWS S3 (LocalStack)

## 3. Estrutura Oficial do Projeto
```text
src/
├── main.ts
├── app.module.ts
├── shared/
│   ├── database/
│   ├── errors/
│   ├── event-bus/
│   ├── logger/
│   └── observability/
└── modules/
    ├── auth/
    ├── classifieds/
    ├── commerce/
    ├── core/
    ├── creators/
    ├── finance/
    ├── system/
    └── tracking/
```

## 4. Convenções Obrigatórias
- **Domain-Driven Design (DDD):** Módulos não acessam o banco de dados de outros módulos diretamente. A comunicação ocorre por Contratos/Interfaces.
- **Modular Monolith:** Código unificado, deploy único, mas fronteiras lógicas estritas como microserviços.
- **Dependency Injection (DI):** Todas as dependências devem ser injetadas via construtor. Instanciação manual de classes de domínio é proibida nos controllers.
- **Unit of Work:** Transações de banco de dados devem ser orquestradas de forma atômica pelos Services.
- **Outbox Pattern:** Integrações assíncronas externas devem usar a tabela de Outbox para garantir *At-Least-Once Delivery*.
- **Cursor Pagination:** Proibido uso de `OFFSET` para paginação.
- **Soft Delete:** Remoção lógica obrigatória para preservar integridade de dados (GDPR compliance documentado).
- **Ledger Append Only:** Imutabilidade estrita no módulo financeiro.
- **Tipos Estritos:** BIGINT para valores financeiros (representando centavos). UUIDv7 para chaves primárias. Idempotência exigida em endpoints mutáveis.

## 5. Decisões Arquitetônicas Congeladas
- Não trocar o adaptador Fastify por Express.
- Não substituir PostgreSQL por banco NoSQL para persistência core.
- Não substituir o Query Builder Kysely por ORMs pesados (ex: TypeORM, Prisma).
- Não remover o padrão Outbox para delegação assíncrona.
- Não modificar o isolamento de módulos (proibido cross-repository fetching).
- Não permitir tipagem `any` (`@typescript-eslint/no-explicit-any: 'error'` está cravado).
- Não reescrever migrations históricas (V001 a V012) – correções exigem novas migrations (ex: V013).
- Não rodar a aplicação como usuário `root` nos containers Docker.

## 6. Critérios para Descongelamento
A infraestrutura base da Sprint 1 somente poderá ser modificada sob as seguintes condições restritas:
- Descoberta de Vulnerabilidade Crítica (CVSS > 8.0) no runtime ou dependências diretas.
- Bug estrutural impeditivo detectado em ambiente de staging/produção.
- Incompatibilidade sistêmica comprovada (bloqueio técnico instransponível).
- Aprovação de um novo documento Architectural Decision Record (ADR).

## 7. Estado Atual
A infraestrutura está pronta para iniciar o desenvolvimento das funcionalidades.
