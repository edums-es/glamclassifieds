# Application Architecture & Operational Flows

**Autor:** Staff Backend Engineer
**Foco:** Engenharia de Aplicação, Orquestração e Casos de Uso
**Status:** Architecture Freeze v1.0 (Database V001-V012 Congelado)

Este documento descreve detalhadamente como o Backend interage com a arquitetura de banco de dados física estabelecida. O foco é provar que a aplicação consegue orquestrar concorrência, consistência ACID e processamento assíncrono perfeitamente usando as fundações atuais.

---

## 1. Fluxos de Identidade e Acesso

### 1. Criação de Conta (Sign Up)
*   **Sequência Completa:** POST `/auth/signup` -> Validação DTO -> Hash de Senha -> `BEGIN` -> Inserção em `auth.users` -> Inserção em `core.members` -> Criação de `finance.wallets` zerada (BRL) -> Inserção em `system.outbox_events` -> `COMMIT` -> Retorna 201.
*   **Tabelas Utilizadas:** `auth.users`, `core.members`, `finance.wallets`, `system.outbox_events`.
*   **Transações (TX):** 1 Transação ACID síncrona englobando os 4 inserts.
*   **Eventos Emitidos:** `member.registered`.
*   **Workers Envolvidos:** Outbox Worker (para disparar email de boas-vindas e notificar CRM).
*   **Pontos de Falha:** E-mail ou CPF já existentes (Unique Violation).
*   **Retry:** Frontend exibe erro; usuário corrige. Worker de email usa *Exponential Backoff*.
*   **Idempotência:** Garantida pelo banco (`uidx_users_lower_email`, `uidx_members_document_cpf`).
*   **Observabilidade:** Logs de latência da TX; rastreio de funil via `tracking.events_raw`.
*   **Rollback:** Se qualquer insert falhar, o `ROLLBACK` destrói a transação. O evento não vai pro Outbox.

### 2. Login
*   **Sequência Completa:** POST `/auth/login` -> Busca `auth.users` -> Verifica Hash -> Gera JWT (ou Session Token) -> Salva em `auth.sessions` -> Opcional: Atualiza last_login assincronamente via Outbox -> Retorna 200 + Token.
*   **Tabelas Utilizadas:** `auth.users`, `auth.sessions`.
*   **Transações (TX):** Read-only para validação, e Autocommit (ou TX curta) para salvar sessão.
*   **Eventos Emitidos:** `member.logged_in` (opcional).
*   **Workers Envolvidos:** Nenhum crítico.
*   **Pontos de Falha:** Credenciais inválidas, conta bloqueada (soft deleted).
*   **Retry:** Rate limiting no IP/Email para evitar Brute Force.
*   **Idempotência:** N/A (Múltiplos logins geram múltiplas sessões).
*   **Observabilidade:** Alertas de picos de erro 401.
*   **Rollback:** N/A.

### 3. Criação de Creator
*   **Sequência Completa:** POST `/creators` -> Valida Member -> `BEGIN` -> Insere `only.creators` -> Insere `commerce.products` (tipo 'subscription' base) -> Insere `commerce.prices` -> Insere `system.outbox_events` -> `COMMIT`.
*   **Tabelas Utilizadas:** `only.creators`, `commerce.products`, `commerce.prices`, `system.outbox_events`.
*   **Transações (TX):** 1 TX envolvendo a criação do perfil e os artefatos base de precificação.
*   **Eventos Emitidos:** `creator.onboarded`.
*   **Workers Envolvidos:** Outbox Worker (notifica aprovação, gera thumbnails padrão).
*   **Pontos de Falha:** Username já em uso; Member já é creator.
*   **Retry:** Usuário escolhe outro username.
*   **Idempotência:** `uidx_creators_username` e `uidx_creators_member_id` impedem duplicação de creators.
*   **Observabilidade:** Métrica de conversão Member -> Creator.
*   **Rollback:** Falha no insert cancela a criação dos produtos base.

---

## 2. Fluxos de Conteúdo e Commerce

### 4. Publicação de Post
*   **Sequência Completa:** POST `/posts` -> Verifica Mídias pré-processadas -> `BEGIN` -> Insere `only.posts` -> Insere vinculações em `only.post_media` -> Insere `system.outbox_events` -> `COMMIT`.
*   **Tabelas Utilizadas:** `only.posts`, `only.post_media`, `system.outbox_events`.
*   **Transações (TX):** 1 TX.
*   **Eventos Emitidos:** `post.published`.
*   **Workers Envolvidos:** Fan-out Worker (calcula ACL e notifica assinantes).
*   **Pontos de Falha:** Mídias não prontas; Banco fora.
*   **Retry:** Retentativa via interface do usuário.
*   **Idempotência:** Frontend envia um `Idempotency-Key` (UUID do Post).
*   **Observabilidade:** Tempo de publicação, quantidade de mídia.
*   **Rollback:** Cancela TX se falhar.

### 5. Compra de Post PPV (Pay-Per-View)
*   **Sequência Completa:** POST `/checkout/ppv` -> `BEGIN` -> Cria `commerce.orders` -> Cria `commerce.order_items` -> Cria `finance.transactions` (pending) -> Chama API Gateway -> (Se síncrono e aprovado) -> Atualiza order/transaction -> Insere `only.post_access` -> Insere `finance.ledger` (Crédito Creator, Débito Taxas) -> Atualiza `finance.wallets` (HOT Update) -> `COMMIT`.
*   **Tabelas Utilizadas:** `orders`, `order_items`, `transactions`, `post_access`, `ledger`, `wallets`.
*   **Transações (TX):** Altamente crítica. Pode ser dividida em 2 TX (TX1: pending. TX2: webhook confirmed) dependendo se o gateway for assíncrono (Pix/Boleto).
*   **Eventos Emitidos:** `order.created`, `order.paid`, `post.unlocked`.
*   **Workers Envolvidos:** Webhook processor (se assíncrono), Outbox worker.
*   **Pontos de Falha:** Cartão recusado, Timeout do Gateway.
*   **Retry:** Transação morre em `pending`, usuário tenta outro cartão.
*   **Idempotência:** `uidx_orders_gateway_ref` garante que o mesmo pagamento não gere dois pedidos.
*   **Observabilidade:** Funil de checkout (abandono vs conversão).
*   **Rollback:** Se a atualização da Wallet falhar, todo o desbloqueio do PPV e Ledger revertem.

### 6. Assinatura de Creator
*   **Sequência Completa:** POST `/checkout/subscribe` -> Mesmo fluxo do PPV, mas insere em `commerce.subscriptions` (status: active/incomplete) dependendo da resposta do gateway.
*   **Tabelas Utilizadas:** `orders`, `transactions`, `subscriptions`, `ledger`, `wallets`.
*   **Transações (TX):** Similar ao fluxo 5.
*   **Eventos Emitidos:** `subscription.created`, `subscription.active`.
*   **Workers Envolvidos:** Webhook processor.
*   **Pontos de Falha:** Race condition de duplo clique.
*   **Retry:** N/A.
*   **Idempotência:** Blindado pelo `uidx_subscriptions_active_unique` da V008_1.
*   **Observabilidade:** MRR (Monthly Recurring Revenue) tracking.
*   **Rollback:** Falha lógica em qualquer etapa reverte tudo.

### 7. Cancelamento de Assinatura
*   **Sequência Completa:** POST `/subscriptions/{id}/cancel` -> `BEGIN` -> `UPDATE commerce.subscriptions SET cancel_at_period_end = TRUE` -> Chama API do Gateway para cancelar renovação -> `COMMIT`.
*   **Tabelas Utilizadas:** `commerce.subscriptions`.
*   **Transações (TX):** 1 TX.
*   **Eventos Emitidos:** `subscription.canceled_pending`.
*   **Workers Envolvidos:** Worker cron para expirar efetivamente no `period_end`.
*   **Pontos de Falha:** Gateway indisponível.
*   **Retry:** Fila assíncrona tenta cancelar no gateway depois, mas o status no banco local muda imediatamente.
*   **Idempotência:** `UPDATE` repetido na mesma assinatura não muda o estado final.
*   **Observabilidade:** Churn Rate.
*   **Rollback:** Se gateway negar e for síncrono, aborta TX.

---

## 3. Fluxos Financeiros (Core Ledger)

### 8. Chargeback (Estorno)
*   **Sequência Completa:** Webhook recebe Chargeback -> Inicia `BEGIN` -> Busca Transaction original -> Cria nova `finance.transactions` (tipo chargeback) -> `INSERT finance.ledger` (Debit Creator, Credit Custódia) -> `UPDATE finance.wallets` (desconta saldo) -> `UPDATE commerce.subscriptions` (suspende) -> `COMMIT`.
*   **Tabelas Utilizadas:** `transactions`, `ledger`, `wallets`, `subscriptions`, `post_access`.
*   **Transações (TX):** 1 TX crítica.
*   **Eventos Emitidos:** `finance.chargeback_received`.
*   **Workers Envolvidos:** Webhook Processor.
*   **Pontos de Falha:** Saldo do Creator fica negativo (suportado por `BIGINT`).
*   **Retry:** Fila de webhook com Dead Letter Queue (DLQ).
*   **Idempotência:** `gateway_transaction_id` único para o evento de chargeback no Stripe.
*   **Observabilidade:** Alerta P1 se taxa de chargeback passar de 1%.
*   **Rollback:** Se falhar bloqueio de wallet, aborta. O webhook retentará mais tarde.

### 9. Saque (Withdrawal)
*   **Sequência Completa:** Creator pede saque -> Verifica KYC/Fraude -> `BEGIN` -> `UPDATE wallets` (move de `balance` para `blocked_cents`) -> Cria `finance.transactions` (status pending) -> Envia PIX via API -> `COMMIT`. Quando o PIX confirma (Webhook) -> `BEGIN` -> Insere no `finance.ledger` (Débito da carteira) -> `UPDATE wallets` (subtrai `blocked_cents`) -> Atualiza transaction -> `COMMIT`.
*   **Tabelas Utilizadas:** `wallets`, `transactions`, `ledger`.
*   **Transações (TX):** 2 TXs isoladas no tempo. (Pedido e Efetivação).
*   **Eventos Emitidos:** `withdrawal.requested`, `withdrawal.completed`.
*   **Workers Envolvidos:** Worker de disparo de saques (lote).
*   **Pontos de Falha:** Saldo insuficiente, chave PIX inválida.
*   **Retry:** Se chave PIX inválida, faz Refund (devolve do blocked_cents pro balance).
*   **Idempotência:** UUID da transação de saque.
*   **Observabilidade:** Fluxo de caixa de saída (Cash-Out).
*   **Rollback:** Falhas revertem o bloqueio.

### 10. Webhook do Gateway (O Caminho do Dinheiro)
*   **Sequência Completa:** API `/webhooks/stripe` recebe payload -> Verifica assinatura HMAC -> Joga na fila SQS/Redis (Retorna 200 pro Stripe) -> Worker puxa o payload -> `BEGIN` -> Verifica se a `finance.transactions` já não tem o mesmo `gateway_transaction_id` com status final (Idempotência via banco) -> Atualiza state machine (Order, Subscription, Wallet, Ledger) -> `COMMIT`.
*   **Tabelas Utilizadas:** Todas as de Commerce e Finance.
*   **Transações (TX):** 1 TX englobando a mutação financeira completa.
*   **Eventos Emitidos:** `webhook.processed`, `order.paid`, etc.
*   **Workers Envolvidos:** Webhook Consumer (alta resiliência).
*   **Pontos de Falha:** Crash no meio do processamento.
*   **Retry:** Se der erro, não faz `ACK` na fila; o Worker consome novamente.
*   **Idempotência:** O banco aborta duplicações via os `UNIQUE PARTIAL INDEXES` das V008_1, V008_2, e V010.
*   **Observabilidade:** Logs do Webhook ID.
*   **Rollback:** Falhas retornam à fila SQS/Redis.

---

## 4. Fluxos Assíncronos e Tracking (O Cérebro)

### 11. Entrada de Evento no Outbox
*   **Sequência Completa:** Ao final de qualquer transação de domínio (ex: Criou Pedido), um `INSERT INTO system.outbox_events (topic, payload)` faz parte do mesmo bloco `BEGIN...COMMIT`.
*   **Tabelas Utilizadas:** `system.outbox_events`.
*   **Pontos de Falha:** Nenhum. Ou a TX principal salva tudo, ou falha tudo (Atomicidade).
*   **Idempotência:** Garantida pelo UUID interno gerado na memória do backend.

### 12. Processamento do Outbox pelo Worker
*   **Sequência Completa:** Worker faz `SELECT ... WHERE processed_at IS NULL FOR UPDATE SKIP LOCKED LIMIT 100` -> Processa os eventos enviando-os para Filas (Kafka/SQS) ou processando lógicas locais -> `UPDATE system.outbox_events SET processed_at = NOW() WHERE id IN (...)`.
*   **Tabelas Utilizadas:** `system.outbox_events`.
*   **Transações (TX):** TX curtas e rápidas focadas em marcação de processamento.
*   **Eventos Emitidos:** Mensagens no Barramento (Event Bus).
*   **Pontos de Falha:** Worker crashar.
*   **Retry:** O Lock do `FOR UPDATE` expira/é solto no rollback, outro worker assume a tupla.
*   **Observabilidade:** Métrica de "Outbox Lag".

### 13. Envio para Meta Conversion API (CAPI)
*   **Sequência Completa:** Worker de Tracking escuta evento `order.paid` do barramento -> Lê payload com `fbp` e `fbc` (vindas do `tracking.events_raw`) -> Formata JSON CAPI -> Dispara HTTP POST para o Facebook Graph API -> Marca como enviado em log no-SQL (Redis/Elastic) ou joga fora o ACK.
*   **Tabelas Utilizadas:** Não usa Postgres na escrita (Para poupar I/O). Usa Redis/Kafka.
*   **Retry:** Resiliência de rede via circuit-breaker. Max retries: 3.
*   **Idempotência:** CAPI usa o `order_id` (UUID) como dedup_id.

### 14. Envio para Google (GTM / Server-Side)
*   **Sequência Completa:** Mesma de cima, mas o worker empacota para Google Measurement Protocol.
*   **Idempotência:** `transaction_id` atua como chave de desduplicação no Google Analytics.

### 15. Recuperação de Carrinho
*   **Sequência Completa:** Cron (a cada 5min) faz `SELECT FROM commerce.orders WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'` -> Joga para Worker -> Worker envia e-mail com link mágico.
*   **Tabelas Utilizadas:** `commerce.orders`.
*   **Observabilidade:** UTMs atachadas ao link mágico para medir conversão de recovery.

### 16. Tracking de Eventos Brutos
*   **Sequência Completa:** Requisição POST `/track` assíncrona do Frontend (pixel interno) -> Backend recebe -> Responde 200 (fire-and-forget) -> Joga num buffer Redis -> Worker (flush) junta 500 eventos e faz 1 `INSERT INTO tracking.events_raw` (Batching) no Postgres.
*   **Tabelas Utilizadas:** `tracking.events_raw`.
*   **Transações (TX):** 1 Autocommit Massivo (Bulk Insert).
*   **Escalabilidade:** Escala perfeita, sem triggers, particionamento nativo mensal no PG.

---

## 5. Fluxos de Conteúdo e Operacionais

### 17. ACL (Access Control List) para PPV
*   **Sequência Completa:** Request GET `/posts/{id}` -> App faz query rápida na `only.post_access` -> `SELECT 1 FROM only.post_access WHERE post_id = X AND member_id = Y LIMIT 1` -> Se true, retorna o Media_URL assinado (Cloudfront Signed URL). Se false, retorna 403 / Blur.
*   **Tabelas Utilizadas:** `only.post_access`.
*   **Idempotência/Segurança:** O índice `uidx_post_access_unique` garante que consultas sejam feitas em microssegundos no cache de RAM do B-Tree.

### 18. Upload de Vídeo
*   **Sequência Completa:** Cliente pede Presigned URL -> App gera S3 Presigned URL -> Retorna pro Client -> Client upa direto no S3 -> Client faz POST `/media/confirm` -> Backend insere `classifieds.listing_media` ou `only.post_media` (status 'processing').
*   **Transações (TX):** Autocommit rápido. Sem gargalos de I/O de rede no banco. O binário não toca no Postgres.

### 19. Processamento de Vídeo
*   **Sequência Completa:** S3 dispara Lambda/EventBridge -> AWS MediaConvert transcodifica (HLS/DASH) -> Salva no bucket de Delivery -> Dispara webhook pro Backend -> Backend atualiza `post_media SET is_processed = TRUE`.
*   **Tabelas Utilizadas:** `only.post_media`.
*   **Retry/Falhas:** Se falhar, Lambda faz DLQ.

### 20. Limpeza de Dados (Partition Drop)
*   **Sequência Completa:** Todo dia às 03:00 AM, um Cron/Job no backend (com credenciais admin) executa: `DROP TABLE system.outbox_events_2026_01_01;` (deletando os dados processados de 7 dias atrás).
*   **Impacto no Banco:** Zero fragmentação, zero Table Bloat, zero uso de `VACUUM`. O disco é recuperado instantaneamente em O(1) pelo OS.
*   **Rollback:** Irreversível (conforme desejado para dados epêmeros).

---

## Veredito do Staff Backend Engineer

A aplicação rodará como um **sistema distribuído moderno e ultra-resiliente**, apesar de usar um banco relacional central. As fronteiras de domínio (Commerce, Content, Finance) não se travam (locks) mutuamente, garantindo escalabilidade.

A arquitetura do banco de dados (V001 a V012) suportará todos os 20 fluxos sem sofrer um único deadlock sistêmico. Não há necessidade de nenhuma alteração estrutural no banco de dados neste momento. A fundação de dados é perfeita para a aplicação proposta.