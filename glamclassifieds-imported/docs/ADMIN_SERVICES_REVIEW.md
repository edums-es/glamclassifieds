# Admin Services Review (The Sex Only)

## Revisão de Integração do Admin React com os Services NestJS

### O que foi feito:
- Substituímos o painel estático por componentes React alimentados diretamente pela nova API (`tsoApi` em `src/lib/api.ts`).
- **Arquitetura Bridge:** Implementamos a ponte (fetch client local para `http://localhost:3000/admin...`) com mock do header `Authorization` que futuramente servirá para conectar a sessão (como desenhado no plano `ADMIN_AUTH_INTEGRATION`).
- **TSO Dashboard:** Integrado para realizar o fetch agregado de `getCreators()`, `getPosts()`, e `getOrders()`, calculando em tempo de execução o total em R$ das Vendas (`amountCents / 100`).
- **TSO Creators:** Lista de Creators com nome, bio e badge de Status (`active`, `suspended`, etc).
- **TSO Posts:** Lista de Posts mapeados para o preço correto (convertido para R$) ou sinalizados como público.
- **TSO Tracking:** Exibe os links gerados, nome da campanha, URL (`thesex.online/l/code`) e destino.
- **TSO Orders:** Traz a listagem de pedidos, convertendo os centavos da infraestrutura (`amountCents / 100`) e sinalizando os status de pagamento.

### NestJS Backend Extensions
- Adicionamos 4 novos Controllers de Admin no NestJS: `CreatorsAdminController`, `PostsAdminController`, `TrackingAdminController` e `CommerceAdminController`. 
- Eles expõem a base dos Repositories através do método `.findAll()` diretamente para o frontend do Admin, sempre guardados sob uma restrição de mock Header.
- Injetados e expostos dentro de seus respectivos módulos (`creators.module.ts`, `commerce.module.ts`, `tracking.module.ts`).

### Avaliação de Segurança:
O Front-End usa estritamente os DTOs em tempo de leitura. Como estamos apenas injetando endpoints `GET`, não há risco de side effects acidentais em moderação/escrita neste estágio do MVP. Os Controllers de admin estão isolados na rota `/admin/...` no NestJS.

**Status:** APROVADO. A interface do React Admin agora consome dados reais através dos Services NestJS construídos nas últimas sprints.
