# Sprint 11: Real End-to-End PostgreSQL Flow

## Objetivos Alcançados
- **Testes com Migrations Reais**: Foi construído um teste E2E (`real-sales-flow.e2e-spec.ts`) inicializando a aplicação NestJS inteira (`CreatorsModule`, `CommerceModule`, `TrackingModule`, `DatabaseModule`) utilizando um banco PostgreSQL real gerido via **Testcontainers**.
- **Carga Estrutural (V001 a V012)**: As migrations reais presentes em `database/migrations` foram processadas ordenadamente no container limpo, e dados vitais de infraestrutura (como `core.members`) foram injetados no início.
- **Manutenção Absoluta**: Controllers, Services, DTOs e Interfaces **não foram alterados**. Todo o comportamento se apoiou inteiramente no contrato pré-estabelecido.

## Fluxo Positivo Testado e Validado (E2E)
1. **Criar Creator**: O onboarding no módulo `CreatorsService` converte e insere na tabela mapeada.
2. **Criar Post PPV**: O `PostsService` cria placeholders na tabela media e publica um Post pago, gerando os registros de forma transacional.
3. **Criar Tracking Link**: O `TrackingService` insere links amarrados ao Post criado com destino apropriado.
4. **Simular Clique**: O link é rastreado gerando estatísticas lógicas válidas (1 clique).
5. **Criar Checkout**: Cria a `Order` em status pendente amarrada ao Post com idempotência `UNIQUE`.
6. **Simular Webhook Aprovado**: Completa a `Transaction` referenciando o ID do provedor (ex: Stripe) e salva a autorização permanente `PostAccess` (ACL).
7. **Confirmações**: Status checados. Acesso liberado retornado corretamente via `checkPostAccess()`.

## Cenários Negativos Testados e Validados
- **Webhook Duplicado**: A restrição do banco previne duplo registro da `Transaction` com o mesmo `gateway_tx_id` (falha na inserção da transação duplicada).
- **Checkout Duplicado (Idempotência)**: Segunda chamada de `createCheckout` com a mesma `idempotency_key` falha com restrição `UNIQUE`.
- **Post Arquivado/Apagado**: Soft Delete remove o acesso em `deleted_at`. Checkout de item não encontrado é abortado.
- **Creator Comprando Próprio Post**: O Service acusa a exceção mapeada quando o `buyerId` (se criador) coincidir com o dono do Post, impedindo a fraude de métricas.

## Arquivos Modificados/Criados
1. `test/e2e/real-sales-flow.e2e-spec.ts` (Criado integrando Testcontainers e todo o NestJS com Migrations Reais).

## Considerações
Os bancos *mockados* foram finalmente superados por um ambiente que levanta a plataforma e testa toda a cadeia de ponta a ponta garantindo as propriedades transacionais e restritivas (*constraints* ACIDs) de maneira confiável e reprodutível.
