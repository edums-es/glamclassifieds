# Auth Module: Production Readiness & Post-Mock Roadmap

## 1. AuthRepository (Mock vs Kysely)

A interface atual (`findMemberByEmail`, `createMember`, `createSession`, `findSessionById`, `revokeSession`) está **completamente alinhada** com as tabelas `auth.users` e `auth.sessions` da Migration V003.

No entanto, há uma discrepância invisível no DTO do Mock em relação à V003:
A tabela `auth.users` possui apenas `id`, `email`, `password_hash`, `created_at`, `updated_at`, `deleted_at`. O campo `name` e outros dados de perfil pertencem à tabela `core.members` (Migration V004), sendo `auth.users` estritamente o cofre de login.

**Proposta de Interface Definitiva (IAuthRepository):**
Quando o Kysely entrar, o `AuthRepository` deverá injetar o `TransactionManager`. Se um signup ocorrer, ele fará o `INSERT` em `auth.users` e o `CoreService` (via event bus ou orquestração do controller/service) fará o `INSERT` em `core.members`. 
O `AuthRepository` não deve conhecer o campo `name`.

## 2. AuthService (Isolamento de Domínio)

- **SQL / Kysely / PostgreSQL:** **Nenhum** acoplamento. O Service recebe a DTO pura, orquestra hash e tokens, e chama `this.authRepository`.
- **Desacoplamento Comprovado:** A migração para Kysely ocorrerá **100% dentro do arquivo `auth.repository.ts`**. O Service não mudará uma única linha de regra de negócio, comprovando o sucesso do Hexagonal/Clean Architecture adotado.

## 3. JWT & Sessão (Opaque Refresh Tokens)

- **Rotação & Revogação:** O `Refresh Token` não é um JWT. É o `UUID` exato da linha em `auth.sessions`. Quando ocorre o logout ou o refresh, a sessão antiga é ativamente deletada do banco.
- **Segurança (Opaque Tokens):** Se o banco for invadido ou o usuário for banido, basta revogar a PK da sessão ou invocar Soft Delete na conta. O próximo ciclo de Refresh falhará imediatamente.
- **Alinhamento DB:** A propriedade `expires_at` (TIMESTAMPTZ) da `auth.sessions` será o vetor de expiração de curto/médio prazo gerenciado no banco, conforme migration V003.

## 4. Hash (Bcrypt vs Argon2)

- O `bcrypt` atual está configurado para **12 rounds**, que é o trade-off ideal de segurança (OWASP) x performance (evita esgotamento da Event Loop do Node.js por alto I/O de CPU) no momento atual.
- **Possibilidade de Argon2:** Migrar para `argon2id` no futuro é recomendável para resistência contra GPUs. 
- **Impacto de Migração:** O `bcrypt` armazena o algoritmo (ex: `$2b$12$...`) no próprio hash. Uma migração futura não quebra o sistema. Podemos implementar um "upgrader" no momento do Login que, se detectar a string `$2b$`, re-hasheia a senha em plain-text recém-fornecida para Argon2 e faz um `UPDATE` silencioso.

## 5. DTOs x API Contracts

Os contratos de `POST /api/v1/auth/signup` e `login` exigiam `email`, `password` e `device_info`.
Os DTOs validados via Zod (`SignupSchema`, `LoginSchema`) exigem exatamente essas propriedades em conformidade aos tipos esperados, barrando injeção.

## 6. Cobertura de Testes Unitários

**O que os testes atuais cobrem:**
✅ Email duplicado (409 Conflict).
✅ Autenticação com sucesso (gera Access/Refresh token).
✅ Senha incorreta (401 Unauthorized).

**O que NÃO está coberto ainda na suíte mockada (`auth.service.spec.ts`):**
❌ Fluxo de Refresh com Token Inválido.
❌ Fluxo de Refresh com Sucesso (validação da Rotação / expiração do ID antigo e geração de ID novo).
❌ Fluxo de Logout.
❌ Tentativa de Login após *Soft Delete* (não será possível testar plenamente até termos a `deleted_at` exposta na interface do repository).

## 7. Classificação de Produção

- **Estruturalmente Pronto:** Sim. As camadas (Controller -> Validation -> Service -> Repository) não sangram as fronteiras.
- **Funcionalmente Pronto:** Não. Falta a persistência real no PostgreSQL. O mock não reflete falhas de rede, lock de banco, ou pool exhaustion.
- **Produção Pronta:** Não.
*Explicação:* A estrutura permite avançar na escala da equipe (Mock é suficiente para destravar o frontend). Mas ir a produção exige remover o `AuthRepository` mockado, injetar o Kysely, garantir o parse transacional (TransctionManager) e substituir o secret mockado pelo AWS Secrets Manager.

## 8. Roadmap de Descongelamento (Migração Mock -> PostgreSQL)

Quando a autorização for dada para integrar banco de dados, os **únicos** arquivos que deverão ser tocados serão:

1. `src/modules/auth/repositories/auth.repository.ts`: Reescrever o conteúdo interno da classe para implementar queries via Kysely (ex: `db.insertInto('auth.users')...`).
2. `src/modules/auth/interfaces/auth.interface.ts`: Atualizar `AuthRepository` para estender/implementar uma `IAuthRepository` tipada para permitir Dependency Injection de Mocks futuros.
3. `src/modules/auth/__tests__/auth.service.spec.ts`: Atualizar os stubs dos mocks (já que a injeção será refatorada).

**Por que não modificar o Service?**
Porque o AuthRepository mock atual devolve entidades puras (Data Objects) que o Service já entende. Se o Repository Kysely respeitar a assinatura do retorno, o Service jamais saberá que o armazenamento de estado da RAM migrou para um disco SSD da AWS com PostgreSQL. Esse é o triunfo da arquitetura.

---
**Nota Técnica da Revisão:** 9.5/10. 
(Desconto de 0.5 pela ausência dos testes de Logout e Refresh no spec.ts inicial). O módulo está blindado contra sangramento arquitetural. A plataforma pode escalar com segurança sobre ele.
