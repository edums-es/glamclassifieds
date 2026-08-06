# Auth Module Freeze

## 1. Escopo do módulo

O módulo `Auth` é estritamente responsável por gerenciar a identidade de acesso, credenciais e a emissão de tokens de segurança.

**O que pertence ao Auth:**
- Validação de credenciais (email e senha).
- Hash de senhas (bcrypt).
- Geração e assinatura de JWT (Access Tokens).
- Emissão e controle de Sessões (Refresh Tokens opacos).
- Revogação de sessões (Logout).

**O que NÃO pertence ao Auth:**
- Auth não conhece o Perfil do Usuário (nome, avatar, bio). Isso é responsabilidade do `Core`.
- Auth não conhece Creator ou seus status. Isso é do `Creators`.
- Auth não conhece Wallet nem Saldos. Isso é do `Finance`.
- Auth não conhece Pedidos ou Produtos. Isso é do `Commerce`.
- Auth não conhece Tracking ou Analytics. Isso é do `Tracking`.

## 2. Responsabilidades

- Garantir que senhas em *plain text* nunca sejam expostas ou salvas.
- Emitir JWTs de vida curta (Access Token).
- Manter o registro de Sessões ativas e vinculá-las a dispositivos.
- Invalidar e rotacionar Refresh Tokens para prevenção de roubo de sessão.
- Isolar completamente o acesso à tabela `auth.users` e `auth.sessions`.

## 3. Dependências permitidas

**Pode utilizar:**
- `Shared` (Logger, Errors, Event Bus).
- `System` (Configurações, JWT Secrets).

**NUNCA poderá acessar diretamente:**
- Tabelas ou repositórios de `Core` (`core.members`).
- Qualquer tabela de `Commerce`, `Finance`, `Creators`, `Classifieds`, etc.

## 4. Interfaces públicas

Contratos expostos para integração com o API Gateway / Controllers:
- `signup(dto, deviceInfo)` -> Retorna Tokens
- `login(dto, deviceInfo)` -> Retorna Tokens
- `refresh(refreshToken, deviceInfo)` -> Rotaciona e Retorna Tokens
- `logout(refreshToken)` -> Revoga sessão
- `validateAccessToken(token)` -> (A ser implementado no Guard global) Retorna Payload do JWT

## 5. Eventos publicados

Quando implementado o Event Bus, o módulo emitirá (apenas documentação):
- `auth.registered` (Payload: userId, email) -> O módulo Core ouvirá para criar o `core.members`.
- `auth.logged_in` (Payload: userId, sessionId, deviceInfo)
- `auth.logged_out` (Payload: sessionId)
- `auth.password_changed` (Payload: userId)
- `auth.session_revoked` (Payload: sessionId)

## 6. Roadmap

**O que mudará quando o Mock for substituído pelo Kysely/PostgreSQL:**
- **AuthRepository:** Será a ÚNICA classe alterada. O Map em memória será substituído por chamadas Kysely `db.insertInto('auth.users')` e `db.insertInto('auth.sessions')`.
- **Controller:** Permanece igual.
- **Service:** Permanece igual.
- **DTOs:** Permanecem iguais.
- **Interfaces:** Permanecem iguais.

*Exceção documentada (Débito Técnico da Sprint 1):* Atualmente, o mock do AuthRepository aceita o campo `name` durante o signup, pois o Core ainda não existia. Quando o Banco Real entrar (Kysely) e o Event Bus estiver ativo, o campo `name` será repassado em memória ou via `auth.registered` para que o Core faça o insert na tabela `core.members`. O AuthRepository real não fará insert de `name`.

## 7. Critérios de aceite

O módulo Auth será considerado *Production Ready* exclusivamente quando:
1. O `AuthRepository` estiver implementado utilizando Kysely e validado contra o schema real (Migration V003).
2. As injeções de variáveis de ambiente (`JWT_SECRET`) forem providas dinamicamente pelo módulo `Config` ao invés de literais/fallback hardcoded.
3. Testes unitários abrangerem os cenários de Refresh Rotation e Logout.
4. Testes de Integração com Testcontainers provarem operações ACID nas tabelas `auth.users` e `auth.sessions`.

STATUS:
AUTH MODULE FROZEN
