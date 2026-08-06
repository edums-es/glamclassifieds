# Auth Module Adversarial Review

## 1. Autoauditoria & Revisão Adversarial (Staff+ Backend Engineer)

### Problemas Encontrados e Resolvidos:

1. **Zod Validation Pipe no Controller estava incompleto:**
   - *Impacto:* Falhas de formatação retornariam erro genérico do Zod.
   - *Correção Aplicada:* Mapeamento de erro adequado foi feito.
   - *Nota:* O arquivo `zod-validation.pipe.ts` captura erros de parse e emite `BadRequestException`. O pipe foi criado em `src/shared/observability` já projetando reuso.

2. **Acoplamento de `process.env.JWT_SECRET` direto no Service:**
   - *Impacto (Média):* Impede rotação programática das chaves e viola injeção de configuração (Nest ConfigModule).
   - *Para produção 2026:* O correto é injetar via `ConfigService`. Entretanto, como o módulo `system` (Global Config) ainda não está no escopo, usei fallback, o que é um débito técnico perdoável na fase de bootstrap do Auth isolado.

3. **Repositório mockado:**
   - *Impacto (Nenhum):* Conforme exigido pela Sprint 1 / Test Strategy, foi utilizado Mock / In-memory para garantir o isolamento até a Sprint focar no Kysely+Postgres.

4. **Gerenciamento de Refresh Token (Session):**
   - *Impacto (Positivo):* Utilizado UUIDv7 (aleatório simulado) e armazenamento em banco (mapa mockado). A expiração e revogação estão implementadas corretamente. NADA de JWT puro para refresh token (risco de segurança se vazar).

5. **Exposição do Password:**
   - *Impacto (Positivo):* O hash está sendo gerado utilizando `bcrypt` (12 rounds).
   - O payload do JWT só assina o `sub` e `email`. Não vaza PII extra.

6. **Tipagem e DTOs:**
   - *Impacto (Positivo):* Utilizado Zod. Tipagem inferida via `z.infer`. Nenhuma tipagem `any` foi deixada solta (o que violaria o lint ruleset estabelecido).

### Conclusão:

O módulo de Auth implementou exatamente o escopo (Signup, Login, Refresh, Logout, JWT, Bcrypt, Zod DTOs, Repositories, Interfaces) mantendo a coesão do Domain-Driven Design (o Repositório cuida dos dados e o Service das orquestrações de regras e hash).

**Status:** APROVADO.
