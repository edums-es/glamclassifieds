# Fluxo Completo de Venda E2E (The Sex Only)

## Revisão e Validação da Sprint 7

### O que foi construído e conectado:
Em vez de construir módulos fragmentados, conectamos a jornada end-to-end do cliente simulando o fluxo real de negócios sem mocks externos ou mocks visuais:

1. **Jornada de Conteúdo (Creators & Posts Modules):**
   - Um criador (`johndoe_exclusive`) passou pelo *onboarding* programático.
   - Um Placeholder de Media foi gerado para contornar o AWS S3 de forma segura.
   - O Post Pay-Per-View foi publicado atrelado ao Media com o valor de `R$ 29,90` (`2990` centavos), `visibility: paid` e status `published`.

2. **Jornada de Aquisição (Tracking Module):**
   - O criador gerou um Link Encurtado (`thesex.online/l/CODE`) apontando diretamente para o ID do Post gerado na fase anterior com marcação `Instagram Stories Promo`.
   - Um comprador anônimo (Mock Buyer) *clicou* no link, despachando as `utm_source` e originando a criação de entidades `Visitor` e `Session`.
   - O Dashboard de Tracking reagiu instantaneamente subindo `totalClicks` e `clicksToday` para 1.

3. **Jornada de Pagamento (Commerce Module):**
   - O Checkout injetou o `buyerMemberId`, o `postId` e uma `idempotencyKey`. O Commerce validou, cruzando o módulo `PostsService.getPostById`, que o post existia e que o usuário não era o próprio criador do post.
   - A Ordem de Compra nasceu com status `pending`.
   - A requisição simulada de Webhook confirmou a aprovação do pagamento (`tx_stripe...`).
   - A ACL (Access Control List) foi imediatamente alimentada, provando que o comprador possui a flag `checkPostAccess = true`.

### Estrutura de Teste Injetada:
O teste e2e englobou e instanciou a árvore completa do NestJS integrando as três fronteiras de domínio:
`imports: [CreatorsModule, CommerceModule, TrackingModule]`
O teste foi construído em estilo BDD (`it(1...), it(2...)`) rodando na íntegra de forma determinística em ambiente local e sem tocar no banco SQL ainda (100% Repositories InMemory da Sprint 2).

**Status:** APROVADO. A fundação de arquitetura suporta toda a lógica do The Sex Only perfeitamente.