# Estratégia de Integração de Autenticação Admin (SSO Node ↔ PHP)

Este documento detalha o funcionamento do mecanismo de login legado em PHP e apresenta a estratégia arquitetural recomendada para que o novo backend em NestJS confie na sessão do administrador sem necessidade de refatorar o PHP ou exigir duplo login.

## 1. Como a sessão é criada (Backend Legado - PHP)
O login administrativo ocorre inteiramente no ecossistema PHP (`/api/index.php`).
Quando as credenciais (email/senha) estão corretas, o PHP invoca `api_start_admin_session()`.
Esta função:
- Define o nome da sessão explicitamente como `thesex_admin` (em vez do padrão `PHPSESSID`).
- Configura o Cookie com as flags de segurança máximas: `Secure`, `HttpOnly` e `SameSite=Lax`.
- Inicia a sessão gravando o `admin_id` no arquivo físico ou store temporário do servidor PHP (via `$_SESSION['admin_id']`).

## 2. Onde o cookie é validado (Backend Legado - PHP)
Para rotas privadas, o PHP utiliza o middleware procedural `api_require_admin(PDO $pdo)`.
- Ele invoca `api_start_admin_session()` para recuperar o cookie da requisição.
- Tenta ler `$_SESSION['admin_id']`.
- **Validação Dupla:** Além de checar a sessão, ele faz uma *query* em tempo real no banco (`SELECT id, email FROM admins WHERE id = :id`) para garantir que o administrador ainda existe e não foi deletado do banco de dados.
- Se falhar, destrói a sessão e retorna erro `401 Unauthorized`.

## 3. Como as permissões são verificadas (Autorização)
Atualmente, o sistema utiliza um modelo **Binário (Tudo ou Nada)**.
Não existem roles (RBAC) ou claims específicos (ex: Administrador vs. Moderador).
Se a função `api_require_admin()` retornar sucesso, o usuário tem acesso total (root) a todas as funções do painel (Métricas, Aprovação de Perfis, Logs de Auditoria).

## 4. Como proteger novas páginas usando o mesmo login (Frontend React)
No arquivo `src/routes/admin.tsx`:
- A UI é envolvida num estado local `admin`. Se `admin` for nulo, a tela exibe o formulário de login.
- O useEffect inicial faz uma requisição `adminApi.me()` (que bate no PHP).
- Para as novas abas (Commerce, Tracking), não é necessário adicionar lógica de auth no frontend. Basta inserir os novos componentes dentro do bloco condicional em que o estado `admin` já está populado (`if (!admin) return <LoginScreen />`).
- O navegador do administrador gerenciará o cookie `thesex_admin` automaticamente nas chamadas de rede.

## 5. Como fazer o NestJS confiar na autenticação do Admin (Single Sign-On / Trust)

O maior desafio é que o NestJS **não tem como ler** a sessão física do PHP diretamente (são arquiteturas distintas e a sessão fica no disco/memória do worker PHP).

**Estratégia Recomendada: Inter-Service Session Validation (Guard Bridge)**

Não tocaremos no código do PHP. Resolveremos através de um Guard nativo no NestJS.

**Passo a Passo da Solução:**
1. **Frontend Request:** O painel React fará chamadas para a nova API do NestJS (ex: `GET /admin/tracking/dashboard`) e deve ser configurado com `credentials: 'include'` (no axios/fetch) para enviar os cookies automaticamente.
2. **NestJS AdminGuard:** Criaremos um guard no NestJS (`AdminSessionGuard`).
3. **Extração do Cookie:** O Guard extrairá o valor do cookie `thesex_admin` recebido na requisição HTTP.
4. **Validação Cross-Backend:** O Guard do NestJS fará uma requisição HTTP interna (Server-to-Server) contra a API do PHP (ex: batendo na rota de status da sessão, como `GET http://localhost/api/me`), injetando o cookie recebido.
5. **Decisão de Confiança:**
   - Se o PHP responder `200 OK`, significa que a sessão é legítima e pertence a um Admin. O Guard do NestJS libera o acesso à rota.
   - Se o PHP responder `401`, o NestJS rejeita o acesso.

**Otimização de Performance (Opcional):**
Como fazer uma chamada HTTP extra para o PHP a cada request no NestJS adiciona latência, o NestJS pode armazenar esse hash de sessão em memória local ou no Redis (`CacheModule`) com um TTL de 5 minutos. Dessa forma, a validação bate no PHP apenas 1 vez a cada 5 minutos, mantendo a resposta ultrarrápida.

### Resumo dos Benefícios:
- O administrador faz o login 1 única vez (Single Sign-On transparente).
- Zero alterações necessárias na base legada em PHP.
- A segurança continua garantida pelas diretrizes do Cookie (`HttpOnly`, `Secure`).
- O NestJS mantém sua isolação baseando suas respostas na fonte da verdade (PHP/Sessão).
