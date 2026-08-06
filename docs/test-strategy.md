# Quality Assurance & Test Strategy (Enterprise Standard)

**Autor:** Principal QA Architect (Ex-Stripe/Nubank/Shopify)
**Foco:** Engenharia de Qualidade, Resiliência, Chaos Engineering e Validação Financeira
**Status:** Architecture Freeze v1.0 (Validação)

A arquitetura está selada. Minha missão não é alterá-la, mas sim provar, através de rigor científico e automação extrema, que ela suporta a realidade hostil da internet. Este documento define a matriz de validação obrigatória para garantir que o sistema não perderá um único centavo nem corromperá um único dado sob stress.

---

## 1. Testes Unitários (Isolamento Rápido)
**Objetivo:** Validar lógica de negócios pura em milissegundos, sem I/O de rede. O uso de Mocks/Stubs é obrigatório.

*   **Services:** Validação de fluxos de orquestração. O `CommerceService` deve ser testado injetando falhas falsas no `FinanceService` para garantir que o *TransactionManager* receba o comando de `ROLLBACK`.
*   **Domain:** Testes matemáticos exaustivos sobre as regras de precificação. Ex: Garantir que descontos (Offers) não gerem preços negativos; validação de TTL de assinaturas.
*   **Repositories:** Testes de construção de queries (Query Builder). Garantir que o SQL gerado para filtros e paginação (Cursor-based) está sintaticamente correto.
*   **Validators:** Validar as blindagens de borda (DTOs). Testar injeção de SQL, payloads malformados, limites de tamanho de string (ex: descrições de 10MB) e UUIDs inválidos.

---

## 2. Testes de Integração (I/O e Contratos)
**Objetivo:** Provar que os módulos se comunicam corretamente com a infraestrutura real. **Uso de Testcontainers (bancos descartáveis em Docker) é mandatório.**

*   **PostgreSQL:** Subir um PG16 real, rodar as migrations V001-V012, e executar `INSERTs`/`UPDATEs` para validar as Foreign Keys, Unique Indexes, restrições do Ledger (Append-Only) e triggers de `updated_at`.
*   **Redis:** Validar gravação, expiração (TTL) e eviction de tokens de sessão e idempotency keys.
*   **S3:** Uso de *LocalStack* para validar a correta geração e expiração dos *Presigned URLs*.
*   **Gateway (Stripe/Asaas):** Uso de *WireMock* para simular latência de rede, timeouts, e retornos HTTP 500 ou 402 (Payment Required) das adquirentes.
*   **Outbox:** Testar se o Worker consegue ler o banco, travar a linha (`FOR UPDATE SKIP LOCKED`) e efetivamente enviar a mensagem para o Barramento (simulado).

---

## 3. Testes End-to-End (E2E) - User Journeys
**Objetivo:** Validar os caminhos críticos simulando o comportamento de um usuário real de ponta a ponta (via chamadas API REST).

*   **Cadastrar usuário:** Validação de dupla-inserção, restrição de CPF e checagem de geração da Wallet zerada.
*   **Virar creator:** Checar a conversão, restrição de `username` único, e auto-criação de produtos base.
*   **Criar produto:** Validação do catálogo e associação do Creator.
*   **Publicar post:** Fluxo com payload, requisição de URL do S3 e inserção na `only.posts`.
*   **Comprar assinatura & Comprar PPV:** O Fluxo Rei. Simular Checkout, Mock do Webhook do Stripe aprovando a transação, e validar a consequência: Pedido (Paid), Transação (Success), Ledger (Soma Zero executada) e ACL Liberada.
*   **Webhook:** Envio de payload assinado (HMAC válido e inválido) para garantir que intrusos tomem HTTP 401, enquanto cargas válidas gerem atualização no banco.
*   **Ledger:** Validar se a query de extrato paginado retorna saldos rigorosamente exatos.
*   **Saque (Withdraw):** Simular pedido, checar cativação (`blocked_cents`), simular webhook de PIX sucesso e atestar débito no Ledger.
*   **Chargeback:** Disparar webhook de disputa perdida. Validar se o Ledger reverte saldos corretamente e se o acesso (ACL) / Assinatura são revogados.
*   **Cancelamento:** Validar a mudança de flag `cancel_at_period_end` sem afetar o acesso imediato.

---

## 4. Testes de Concorrência (Race Conditions)
**Objetivo:** Provar que a blindagem transacional (ACID) desenhada pelo Arquiteto de Banco de Dados funciona sob fogo cruzado. Execução paralela (Threads/Goroutines).

*   **100 checkouts simultâneos:** Disparados contra a mesma conta e mesmo produto. Apenas 1 pode gerar a fatura.
*   **100 webhooks simultâneos:** O mesmo Webhook de sucesso de pagamento do Stripe entregue 100x ao mesmo tempo. 99 devem falhar no `uidx_transactions_gateway_tx` ou serem descartados. O Ledger deve ter apenas 1 registro.
*   **100 assinaturas simultâneas:** Forçar duplicação. Garantir que `uidx_subscriptions_active_unique` devolve erro 409 em 99 requisições.
*   **100 saques simultâneos:** Tentar sacar R$ 100 simultaneamente 100 vezes de uma conta que só tem R$ 100. Apenas o 1º passa, os outros 99 tomam HTTP 400 (Insufficient Funds).
*   **Troca simultânea de ofertas:** Dois admins alternando a oferta principal no mesmo milissegundo. O banco deve aceitar apenas um `is_active = TRUE` graças ao índice da V008_2.
*   **Uploads simultâneos:** Pedido massivo de Presigned URLs para avaliar contenção no S3 e no limitador de rate.

---

## 5. Testes de Carga (Load & Stress Testing via K6)
**Objetivo:** Provar a escalabilidade e identificar o ponto de quebra (Bottleneck) da infraestrutura.

*   **1.000 a 100.000 usuários:** Simular tráfego de leitura no Feed (`GET /feed`). Verificar se a resposta se mantém abaixo de 200ms com *Cursor-Based Pagination* atuando.
*   **1 milhão de eventos tracking:** Disparar Rajada (Spike Test) de requisições analíticas (`POST /tracking`). Validar se o Redis absorve o impacto e se o Worker realiza os *Bulk Inserts* no Postgres sem travar a thread principal.
*   **100 mil registros no ledger:** Teste de inserção massiva para provar a ausência de *Lock Contention* e validar que a *Soft Reference* (ADR 001) mantém o banco ágil.

---

## 6. Chaos Engineering (Tolerância a Falhas)
**Objetivo:** Derrubar a infraestrutura deliberadamente no meio do processo e provar que o sistema se recupera sozinho. Ferramentas: Toxiproxy / Chaos Mesh.

*   **Redis fora:** A API deve sobreviver (degradar graciosamente). Tracking event falha rápido (503). Autenticação com JWT nativo deve continuar funcionando, mas blocklists falham.
*   **Stripe fora:** Circuit Breaker do Node.js abre após 5 falhas. Checkout retorna 503 imediatamente protegendo a Thread Pool do Backend.
*   **S3 fora:** Geração de Presigned URL cai. Sistema alerta (P1) mas Feed continua lendo o que está no cache da CDN.
*   **Banco lento:** Adicionar 5 segundos de latência simulada no PG. Validar se os timeouts das APIS encerram a conexão (evitando esgotamento de RAM no backend).
*   **Worker morto / Fila parada:** Matar o processo do worker no meio de um processamento. Provar que, ao reiniciar, a fila SQS ou o Outbox (`FOR UPDATE SKIP LOCKED`) reentrega a mensagem (At-Least-Once Delivery) sem duplicar efeitos financeiros.

---

## 7. Disaster Recovery (DR)
**Objetivo:** O que acontece quando um meteoro cai no Data Center.

*   **Backup & Recovery Point Objective (RPO):** Point-in-Time Recovery (PITR) ativado via WAL do Postgres. Tolerância de perda de dados máxima estabelecida em: **Zero para transações fechadas** e **< 5 minutos** para perdas físicas catastróficas totais.
*   **Recovery Time Objective (RTO):** Tempo máximo tolerado para a aplicação voltar online a partir do snapshot: **< 15 minutos**.
*   **Restore & Rollback:** Teste mensal simulado de subida de infraestrutura secundária provando que o dump do PG pode ser restaurado e que as migrações (Flyway/Liquibase) rodam perfeitamente validando o checksum.

---

## 8. Critérios de Aprovação (Go/No-Go para Produção)
Para a branch `main` ser aceita pela esteira CI/CD e sofrer deploy em produção, ela deve obrigatoriamente cumprir:

1.  **Cobertura de Testes (Coverage):** > 90% em Módulos Críticos (Commerce, Finance).
2.  **Pass Rate de E2E Financeiro:** 100%. Uma única falha em fluxo de pagamento quebra a build. Sem exceções.
3.  **Auditoria de Migrations:** A esteira (CI) deve compilar um banco limpo do zero rodando a `V001` até a `V012` perfeitamente em menos de 10 segundos. Nenhuma *Migration* pode ser editada (Validação de Hash imutável).
4.  **Zero Warnings Estáticos:** SonarQube / ESLint devem retornar zero falhas críticas ou bloqueantes de segurança.
5.  **Teste de Concorrência Passed:** Os scripts de simulação de Race Condition de saque e assinatura dupla devem rodar com 100% de sucesso (O banco deve rejeitar corretamente).

*Se estes critérios forem desrespeitados, a arquitetura recusa o deploy.*