# Sprint 10: PostgreSQL Integration for CommerceRepository

## Objetivos Alcançados
- **Migração do Repository**: O `CommerceRepository` (que antes usava Map/em-memória) foi reescrito para utilizar **Kysely** gerando queries SQL type-safe contra um banco **PostgreSQL**.
- **Atualização do Schema**: O arquivo `src/shared/database/schema.ts` foi atualizado incluindo `only_orders`, `only_transactions`, e `only_post_access`.
- **Manutenção de Contrato**: Nenhum Controller, Service, DTO ou Interface foi modificado. A arquitetura continua exatamente igual.
- **Segurança de Concorrência via Banco**: A corrida de dados (race condition) identificada nos sprints anteriores foi eliminada estruturalmente. Constraints `UNIQUE` no banco de dados cuidam da concorrência e idempotência de maneira rígida, não dependendo de travas locais do código.

## Validações Atendidas no Teste de Integração (Testcontainers)
- Criação de Order.
- Criação de Transaction (simulando intenções de pagamento).
- Concessão de PostAccess (ACL) com restrição `UNIQUE(member_id, post_id)`.
- Idempotência: `UNIQUE(idempotency_key)` na criação de ordens. Impede efetivamente a **dupla compra**.
- Transações duplicadas no Webhook: Protegido por `UNIQUE(gateway_tx_id)`.
- Rollback de transação: Testado simulando uma falha e confirmando o desfazimento no banco.
- **Teste de Carga Concorrente (50 checkouts simultâneos)**:
  - 50 tentativas ao mesmo tempo (via `Promise.allSettled`).
  - Resultado confirmado no teste: **1 Order válida, 49 falhas** na camada de inserção da Order.
  - Teste de ACL concorrente: 50 webhooks tentaram conceder o acesso ao mesmo tempo, gerando **1 ACL e 49 falhas**.

## Arquivos Modificados/Criados
1. `src/modules/commerce/repositories/commerce.repository.ts` (Atualizado para PostgreSQL)
2. `src/shared/database/schema.ts` (Atualizado incluindo estruturas do Commerce)
3. `src/modules/commerce/__tests__/commerce.repository.integration.spec.ts` (Criado)

## Próximos Passos
O próximo avanço foca nos módulos subsequentes sem quebrar os anteriores.
