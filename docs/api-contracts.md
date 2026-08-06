# API Contracts Blueprint (Enterprise Standard)

**Autor:** Principal API Architect
**Foco:** Contratos Públicos, Governança de Integração e Frontend/Mobile API
**Status:** Architecture Freeze v1.0 (Database e Backend Architecture Congelados)

Este documento define o contrato estrito de comunicação entre as interfaces de usuário (Frontend/Mobile), sistemas externos e o Backend. Ele atua como a única fonte de verdade para a geração futura de especificações OpenAPI/Swagger.

---

## 1. Convenções Gerais

*   **Versionamento:** Base path de todas as requisições será `/api/v1`.
*   **Formato:** `application/json` restrito para Request e Response (Uploads via S3 Presigned URLs, sem `multipart/form-data` no backend core).
*   **Paginação:** *Cursor-based Pagination* obrigatória para endpoints de alta volumetria (ex: Feed, Ledger, Tracking). Uso de `?cursor={UUIDv7}&limit=20`. *Offset-based* (`?page=1&limit=20`) permitido apenas para tabelas lentas de backoffice.
*   **Filtros & Ordenação:** Passados via Query String. Padrão: `?sort=-created_at&status=active`.
*   **Valores Monetários:** Estritamente em inteiros (centavos). Ex: `price_cents: 1000` (R$ 10,00).
*   **Cabeçalhos Padrão (Headers):**
    *   `X-Idempotency-Key`: Obrigatório em métodos `POST`/`PATCH` críticos.
    *   `X-Request-Id`: Gerado pelo client ou gateway, retornado no response.
    *   `X-Trace-Id`: Injetado pelo OpenTelemetry para tracing.
*   **Códigos HTTP Padrão:** `200` (OK), `201` (Created), `204` (No Content), `400` (Bad Request), `401` (Unauthorized), `403` (Forbidden/ACL), `404` (Not Found), `409` (Conflict/Idempotency), `422` (Unprocessable Entity/Validation), `429` (Too Many Requests), `500` (Internal).
*   **Erros Padronizados:**
    ```json
    {
      "error": {
        "code": "INSUFFICIENT_FUNDS",
        "message": "Wallet balance is insufficient.",
        "details": [],
        "trace_id": "req-12345"
      }
    }
    ```

---

## 2 & 3. Auth APIs (Identidade e Sessão)

### `POST /api/v1/auth/signup`
*   **Descrição:** Criação da conta de usuário, membro e carteira financeira atrelada.
*   **Auth / Permissões:** Public.
*   **Request Body:** `email`, `password`, `document_cpf` (Opcional, depende do KYC).
*   **Response Body (201):** `user_id`, `member_id`, `access_token`, `refresh_token`.
*   **Possíveis Erros:** 409 (Email em uso), 422 (Senha fraca).
*   **Eventos Publicados:** `member.registered`.
*   **Workers Disparados:** Outbox Worker (Boas-vindas).
*   **Idempotência:** Garantida pelo `uidx_users_lower_email` no banco.

### `POST /api/v1/auth/login`
*   **Descrição:** Autenticação e emissão de JWT.
*   **Auth / Permissões:** Public.
*   **Request Body:** `email`, `password`, `device_info`.
*   **Response Body (200):** `access_token`, `refresh_token`, `expires_in`.
*   **Eventos:** `member.logged_in`.

### `POST /api/v1/auth/refresh`
*   **Descrição:** Renovação do Access Token (JWT curto de 15m) usando Refresh Token.
*   **Request Body:** `refresh_token`.

### `POST /api/v1/auth/logout`
*   **Descrição:** Revogação da sessão ativa.
*   **Auth / Permissões:** Authenticated (JWT).
*   **Request Body:** `refresh_token`.
*   **Response Body (204):** Empty.

---

## 4. Members APIs

### `GET /api/v1/members/me`
*   **Descrição:** Retorna os dados do membro logado (nome, avatar, status de creator).
*   **Auth / Permissões:** Authenticated.

### `PATCH /api/v1/members/me`
*   **Descrição:** Atualiza dados de perfil não sensíveis.
*   **Auth / Permissões:** Authenticated.
*   **Request Body:** `display_name`, `avatar_url`.

---

## 5. Creator APIs

### `POST /api/v1/creators`
*   **Descrição:** Converte um Member em Creator (Onboarding).
*   **Auth / Permissões:** Authenticated (Apenas Members que não são Creators).
*   **Request Body:** `username`, `bio`, `display_name`.
*   **Response Body (201):** Dados do Creator e Produtos Base criados.
*   **Eventos Publicados:** `creator.onboarded`.
*   **Workers Disparados:** Outbox Worker (Setup de loja/Notificações).
*   **Idempotência:** `uidx_creators_member_id` evita conversão dupla.

### `GET /api/v1/creators/{username}`
*   **Descrição:** Perfil público do Creator.
*   **Auth / Permissões:** Public.
*   **Response Body (200):** Dados do perfil, contagem de posts, preço da assinatura (se houver).

---

## 6. Posts APIs

### `POST /api/v1/posts`
*   **Descrição:** Publica um conteúdo (Público ou PPV).
*   **Auth / Permissões:** Authenticated + Role: `Creator`.
*   **Parâmetros (Body):** `content`, `price_cents`, `media_ids` (Array de UUIDs de `only.post_media`).
*   **Header:** `X-Idempotency-Key` (Obrigatório).
*   **Eventos:** `post.published`.
*   **Workers:** Fanout Worker (Notificar assinantes).

### `GET /api/v1/posts/{id}`
*   **Descrição:** Detalhes de um post. O payload varia conforme a ACL. Se o member pagou/assina, a mídia vai junto. Se não, mídia vai com watermark/blur e URL nula.
*   **Auth / Permissões:** Authenticated (Leitura pública permitida para payload parcial).
*   **Possíveis Erros:** 403 (ACL Negou acesso à mídia original).

---

## 7. Feed APIs

### `GET /api/v1/feed`
*   **Descrição:** Timeline mesclada de posts dos creators assinados e posts recomendados.
*   **Query String:** `cursor`, `limit`.
*   **Response:** Array de Posts e `next_cursor`.
*   **Auth:** Authenticated.

---

## 8. Media APIs

### `POST /api/v1/media/presigned-url`
*   **Descrição:** Solicita permissão de upload para o S3.
*   **Auth / Permissões:** Authenticated.
*   **Request Body:** `filename`, `content_type`, `file_size`, `intent` (post, avatar, listing).
*   **Response Body (201):** `upload_url`, `media_id` (UUID pendente), `expires_at`.

---

## 9. Commerce APIs (Catálogo)

### `GET /api/v1/commerce/products`
*   **Descrição:** Lista produtos (Subscriptions, PPV) ativos de um Creator.
*   **Query String:** `creator_id`.
*   **Auth:** Public.

### `POST /api/v1/commerce/offers`
*   **Descrição:** Cria um desconto temporário (Ex: Black Friday).
*   **Header:** `X-Idempotency-Key`.
*   **Erro Crítico (409):** `uidx_offers_single_active` estoura se houver oferta paralela ativa.

---

## 10. Checkout APIs (Hot Path)

### `POST /api/v1/checkout/ppv`
*   **Descrição:** Inicia a compra de um Post Pay-Per-View.
*   **Auth / Permissões:** Authenticated.
*   **Header:** `X-Idempotency-Key` (Obrigatório).
*   **Request Body:** `post_id`, `payment_method_data` (Token do cartão ou pedido PIX).
*   **Response (201/202):** `order_id`, `transaction_status`, `client_secret` (Se 3DSecure/PIX).
*   **Eventos:** `order.created`, `order.pending`.
*   **Workers:** Gateway Integration Worker (se processamento assíncrono).

### `POST /api/v1/checkout/subscribe`
*   **Descrição:** Assina um Creator.
*   **Eventos:** `subscription.created`.
*   **Erro Crítico (409):** `uidx_subscriptions_active_unique` barra double-billing.

---

## 11. Subscription APIs

### `GET /api/v1/subscriptions/me`
*   **Descrição:** Lista assinaturas ativas e passadas do usuário logado.

### `POST /api/v1/subscriptions/{id}/cancel`
*   **Descrição:** Marca a renovação automática como falsa (`cancel_at_period_end = TRUE`).
*   **Auth:** Authenticated (Apenas dono da assinatura).
*   **Idempotência:** Repetir a requisição retorna 200, pois o UPDATE é cego.

---

## 12 & 13. Wallet & Ledger APIs

### `GET /api/v1/wallets/me`
*   **Descrição:** Consulta o saldo disponível (`balance_cents`) e bloqueado (`blocked_cents`).
*   **Auth:** Authenticated.

### `GET /api/v1/ledger/me`
*   **Descrição:** Extrato financeiro imutável.
*   **Query String:** `cursor` (usado com BRIN index), `start_date`, `end_date`.
*   **Response:** Array de transações do Ledger (Debit/Credit, referências).

---

## 14. Withdraw APIs (Saques)

### `POST /api/v1/withdrawals`
*   **Descrição:** Solicita transferência do saldo disponível para conta bancária via PIX.
*   **Auth:** Authenticated + KYC Validado.
*   **Request Body:** `amount_cents`, `pix_key`.
*   **Eventos:** `withdrawal.requested`.
*   **Workers:** Payout Worker (Processa em batch diário).
*   **Erro:** 400 (Saldo insuficiente).

---

## 15. Tracking APIs (Alta Vazão)

### `POST /api/v1/tracking/events`
*   **Descrição:** Coletor de Analytics/Pixels do Frontend (Fire-and-Forget).
*   **Auth:** Public (Suporta SessionToken ou Fingerprint).
*   **Request Body:** Array de eventos (Batching permitido: `[{ event_name, url, timestamp, metadata }]`).
*   **Response (202 Accepted):** O backend deposita no Redis/Buffer e retorna imediatamente.
*   **Workers:** Tracking Flush Worker (Descarrega no PG).

---

## 16. Classifieds APIs

### `GET /api/v1/classifieds/categories`
*   **Descrição:** Árvore de categorias (Cachada em CDN).

### `GET /api/v1/classifieds/listings`
*   **Descrição:** Busca geolocalizada e paginada de anúncios.
*   **Query String:** `region_state`, `region_city`, `category_slug`, `q`, `cursor`.
*   **Auth:** Public.

### `POST /api/v1/classifieds/listings`
*   **Descrição:** Cria um anúncio (Draft).
*   **Auth:** Authenticated.

---

## 17. Admin APIs

### `GET /api/v1/admin/users`
*   **Descrição:** Backoffice - Lista de usuários.
*   **Auth / Permissões:** Authenticated + Role: `Admin`.

### `POST /api/v1/admin/moderation/ban`
*   **Descrição:** Suspende um usuário ou criador (Aciona Soft Delete e Flags).

---

## 18. Webhook APIs (Critical Integrations)

### `POST /api/v1/webhooks/stripe`
*   **Descrição:** Recebe eventos assíncronos de pagamentos, assinaturas e chargebacks do Stripe.
*   **Auth:** Assinatura HMAC Header (`Stripe-Signature`).
*   **Response (200 OK):** Sem body. Processamento delegado à SQS.
*   **Idempotência:** Validação obrigatória da `gateway_transaction_id` contra a tabela `finance.transactions` pelo Worker, antes de debitar/creditar o Ledger.

### `POST /api/v1/webhooks/mediaconvert`
*   **Descrição:** Recebe notificação da AWS Lambda de que o vídeo foi transcodificado com sucesso.
*   **Ação:** Atualiza `is_processed = TRUE` na tabela `post_media`.

---
*Veredito do Arquiteto: Todas as APIs descritas representam interações semânticas restritas (REST), ancoradas estritamente nas capacidades do banco físico aprovado. Todos os Gargalos ACID, ACL e Idempotência estão mitigados neste contrato.*