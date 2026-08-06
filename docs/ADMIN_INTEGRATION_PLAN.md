# Admin Integration Plan (The Sex Only)

## 1. Mapeamento do Admin Atual

O painel administrativo atual é dividido em duas partes fundamentais: Frontend e Backend (Legado).

### Frontend (React / Vite)
- **Localização:** `src/routes/admin.tsx` (Arquivo monolítico).
- **Abordagem:** É uma Single Page Application baseada em React (Vite) e `@tanstack/react-router`. Todo o dashboard (UI, Sidebar, seções) existe dentro desse mesmo arquivo.
- **Seções Existentes (`activeSection`):** 
  - `overview` (Métricas)
  - `queue` (Moderação de Perfis)
  - `members` (Membros)
  - `activity` (Logs de Auditoria)
  - `security` (Senha do Admin)
- **Componentes UI:** O layout é renderizado diretamente dentro da função `AdminPage()`, contendo uma barra lateral (Sidebar) e renderização condicional baseada na variável de estado `activeSection`.
- **Comunicação com a API:** Utiliza o objeto `adminApi` que exporta serviços a partir de `src/lib/api.ts`.

### Backend (PHP Legado)
- **Localização:** O backend do Admin roda fora do ambiente Node.js. Encontra-se inteiramente no ecossistema PHP na pasta `/api/`.
- **Roteamento Central:** O roteador é um script flat localizado em `/api/index.php`. Ele intercepta `api_request_path()` e despacha as funções no estilo procedural e rotas hardcoded `if ($method === '...' && $path === '...')`.
- **Autenticação:** Baseada em Sessões PHP clássicas (`PHPSESSID` / `thesex_admin`). Configura cookies HTTP-Only e SameSite=Lax.
- **Função de Guarda:** `api_require_admin(PDO $pdo)` valida se o admin está logado via `$_SESSION['admin_id']`. Não há níveis de acesso. É um sistema "Tudo ou Nada".
- **Banco de Dados:** Utiliza PostgreSQL cru com conexões PDO (via classe em `/api/src/Database.php`).

## 2. Pontos de Extensão (Onde alterar?)

Para adicionar o novo módulo (The Sex Only Commerce/Tracking) dentro deste ambiente sem refazer tudo:

### No Frontend (`admin.tsx`)
1. **Menu Lateral (Sidebar):** Precisamos adicionar botões para as novas abas.
2. **State de Navegação:** Adicionar os novos caminhos à string literal do `activeSection` (ex: `'tso-commerce'` e `'tso-tracking'`).
3. **Novos Componentes de View:** Ao invés de inchar a função principal, devemos criar funções renderizadoras `function AdminCommerceView() { ... }` dentro do arquivo ou importá-las (o recomendado seria modularizar, mas manter o estilo monolítico é a regra para o MVP se necessário).
4. **Chamadas de Rede:** Adicionar novos métodos no `adminApi` (em `src/lib/api.ts`).

### No Backend Node.js vs PHP Legado
Temos um problema arquitetural e estratégico de "Split Brain" (cérebro dividido). 
O nosso módulo "The Sex Only" foi inteiramente desenvolvido em **NestJS** (Node 22, na pasta `src/modules/...`), contendo o módulo *Creators*, *Commerce* e *Tracking*.

O painel de admin (frontend) faz requisições hoje exclusivamente para `/api/...` (onde roda o PHP legado).

## 3. Estratégia de Integração (Como integrar Node + PHP?)

### Decisão Principal: 
O admin deve se comunicar com o **Node.js (NestJS)** para gerenciar *Creators*, *Commerce* (Vendas) e *Tracking*. Não podemos e não devemos replicar em PHP regras de negócio que construímos na Sprint 2 (Commerce/Posts/Idempotência/Tracking).

### A Estratégia de Ponte (Bridge Auth)
Como a sessão vive no PHP (`thesex_admin`), mas os dados vivem no NestJS:
1. **O admin.tsx logará normalmente pelo PHP:** O login e a validação do `adminApi.me()` continuam chamando o PHP.
2. **Criar Gateway de Sessão no Nest:** Criar um guard simples no NestJS chamado `LegacyAdminGuard` que recebe os cookies (`thesex_admin`). O NestJS faz uma requisição back-to-back local para o PHP (ex: `http://localhost/api/me`) para perguntar: "Essa sessão é válida?".
3. **Se sim:** O NestJS autoriza o request de gestão no painel de administração (ex: listar Orders, listar Tracking).

Alternativa mais simples (para o front):
Criar rotas no PHP (`/api/tso/commerce`) que atuam como simples **Reverse Proxy (Curl)** para o backend NestJS, repassando o request caso `api_require_admin` passe. 

**Abordagem Vencedora (Mais Segura e Rápida): Frontend chamando o NestJS Diretamente**
O Frontend, ao obter sucesso no `adminApi.login`, passa a incluir um Header estático ou JWT especial configurado no Admin para chamar as rotas do NestJS, ou o NestJS valida o Cookie do PHP.

## 4. Ordem Correta de Implementação

1. **Camada NestJS (API Admin):**
   - Criar `AdminGuard` no backend NestJS (Pode ser baseado numa `ADMIN_API_KEY` apenas para que o frontend React consiga acessar, ignorando temporariamente a ponte complexa com a sessão do PHP, ou lendo o cookie do PHP).
   - Criar Controllers no NestJS (ex: `TrackingAdminController`, `CommerceAdminController`) que exponham os dados (Analytics gerais, todas as vendas, todos os links criados pelos creators).
   
2. **Camada Cliente de API (`src/lib/api.ts`):**
   - Adicionar os métodos na interface `adminApi` (ex: `listOrders()`, `listTrackingLinks()`). Apontá-los para a base URL do NestJS em vez do `/api` PHP.

3. **Camada Frontend UI (`src/routes/admin.tsx`):**
   - Atualizar a união de tipos `activeSection` para permitir `'tso-commerce'` e `'tso-tracking'`.
   - Modificar a renderização do Menu (lucide-react icons, ex: `CreditCard`, `Link`).
   - Criar os componentes isolados (ex: `function CommerceDashboard()`) e adicioná-los ao `switch/case` (ou if-statements) da renderização principal da página do admin.

## 5. Riscos e Precauções

- **Risco de Monólito no React:** O arquivo `admin.tsx` já é denso. Adicionar o dashboard inteiro do *The Sex Only* lá dentro pode torná-lo insustentável. **Mitigação:** Criar componentes em arquivos separados na pasta `src/components/admin/` e apenas importá-los no `admin.tsx`.
- **Risco de Segurança da Sessão (Split Brain):** Se o front esquecer de enviar o Auth Token correto pro NestJS, vaza dados. **Mitigação:** Uso rigoroso do Guard na porta dos novos controllers do NestJS.
- **Choque de Estilo de UI:** O Admin usa Shadcn/UI, Tailwind e ícones Lucide. **Mitigação:** Devemos inspecionar o HTML atual (a cor da sidebar, os botões, tabelas) para que os novos componentes do "The Sex Only" pareçam nativos à plataforma legada, sem quebra de experiência.

## 6. Arquivos que precisarão ser modificados

1. `src/routes/admin.tsx` (Menu, Seções, Componentes Wrapper)
2. `src/lib/api.ts` (Novas chamadas para o NestJS)
3. `src/modules/...` (No backend NestJS: Criação de rotas dedicadas ao uso administrativo para ler agregados de Commerce e Tracking que hoje não existem para a visão global).
4. `vite.config.ts` (Possível necessidade de configurar um proxy em dev-mode para rotear chamadas de API do front para o NestJS local).

## 7. Resumo da Ação Restrita

A arquitetura do PHP é arcaica e deve atuar apenas como guardião das regras legadas de classificados (Profiles de Acompanhantes/pending/rejected). Tudo relacionado ao *The Sex Only* (Creator, Posts, Checkout, Tracking) **permanece no NestJS**, e o frontend React (que é a ponte agnóstica dos dois mundos) interligará ambas as APIs dentro da mesma interface.