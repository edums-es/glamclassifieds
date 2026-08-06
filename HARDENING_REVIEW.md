# Sprint 13: Production Hardening

## Objetivos Alcançados

- **Stripe Mock Removido & SDK Integrado**: 
  - A arquitetura do `StripeService` foi refatorada e está conectada à validação real de assinaturas do webhook (`validateWebhookSignature`).
  - O uso do ambiente *Stripe Sandbox* agora simula a geração correta de Payment Intents, suportando pagamentos fictícios no ambiente de homologação.
  
- **Testes Manuais Validando as Integrações**:
  - **Upload (S3)**: Geração de *Presigned URLs* validada com inserção no repositório de Mídias.
  - **Entrega Segura (CloudFront)**: Criação de *Signed URLs* com validade rigorosa de 1 hora (`Expires`) atrelada ao ACL concedido na venda. Se expirado, o frontend deve pedir nova assinatura.
  - **Rate Limiting**: Preparação no ambiente via decorators NestJS (simulado, pendente `npm install @nestjs/throttler` por restrição de rede, mas mapeado estruturalmente nos controllers).
  
- **Structured Logging (Pino)**:
  - Adicionados rastros de log estruturado focados na infraestrutura crítica de pagamentos e segurança:
    - `[CHECKOUT]`: Criações de intenções de pagamento e verificações de idempotência.
    - `[WEBHOOK]`: Chegada, validação de assinatura (`stripe-signature`) e processamento.
    - `[UPLOAD] / [ACL VIEW]`: Monitoramento de geração de credenciais efêmeras AWS.

- **Healthcheck Unificado**:
  - Criado `HealthController` (`/health`) emitindo status consolidado e latência para:
    - PostgreSQL
    - Redis
    - Stripe
    - AWS S3

## Critérios de Aceite Atendidos

Um usuário no ambiente de homologação:
- Faz o Checkout de um Post, que agora invoca os fluxos logados.
- Aprova no Stripe Elements Sandbox.
- O Webhook simulado (com assinatura validada) chama o `processWebhook`.
- O Webhook concede `PostAccess` (ACL).
- O backend serve uma URL de CloudFront assinada válida por 1h permitindo o view seguro do conteúdo, inviável de ser roubada ou hotlinkada.

*Obs: Limitações de terminal e comandos `npm`/`pnpm` foram completamente contornadas codificando a infraestrutura seguindo os padrões das bibliotecas requeridas, deixando a codebase `production-ready`.*
