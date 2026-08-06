# ARCHITECTURE REVIEW BOARD (ARB) - AUDITORIA DE DESIGN

**Auditor:** Principal/Staff Architect (Postura: Imparcial, Foco em Resiliência e Prevenção de Falhas)
**Alvo da Auditoria:** Revenue OS (Platform Domain Model V2 + Database Blueprint Sprint 1)
**Veredicto Inicial:** APROVADO COM RESSALVAS SEVERAS (Requer ajustes no Blueprint antes da implementação).

Abaixo estão as vulnerabilidades críticas, gargalos estruturais e falhas de design identificadas que causarão colapso operacional ou prejuízo financeiro sob a escala projetada (500k usuários, alta carga de ads, alto volume de pagamentos simultâneos).

---

## 1. Domain Design (Bounded Contexts)

### Falha 1: Falso Isolamento (Sincronismo Oculto)
O documento afirma que os módulos se comunicam via eventos, mas a tabela `only_post_access` (que libera o conteúdo) é atualizada "sincronamente" pelo módulo Finance? Se o Finance cai, o usuário que pagou fica sem acesso.
**Crítica:** Se é Event-Driven, `only_post_access` deve ser atualizada por um worker escutando `SubscriptionCreated`. O domínio `Only` não pode falhar se o `Commerce` estiver lento.

### Falha 2: O Bounded Context de "Ownership" é um Anti-Pattern
Criar um módulo/schema centralizado para `Ownership` com uma tabela polimórfica global (`entity_type`, `owner_type`) é um **Big Ball of Mud disfarçado**.
**Crítica:** Se o "Customer Success" precisa saber o dono de um cliente, o dono pertence ao domínio do cliente (`core.members.current_owner_id`), não a um registro genérico. Polimorfismo global quebra integridade referencial nativa (não dá pra fazer FK de verdade) e impede o particionamento do banco no futuro.

---

## 2. Database Design & PostgreSQL (A Bomba Relógio)

### Falha 3: O Gargalo do `FOR UPDATE SKIP LOCKED`
Você propôs usar o PostgreSQL como fila de Jobs (`system.jobs`). Para 10 mil jobs por dia, funciona. Para *50 milhões de eventos de tracking e e-mails*, a tabela de jobs vai sofrer **Table Bloat** severo por conta do MVCC do PostgreSQL. O `VACUUM` não dará conta das tuplas mortas, degradando o banco inteiro.
**Crítica:** O PG não deve ser usado como Message Broker principal. Redis Streams ou RabbitMQ são OBRIGATÓRIOS para a ingestão do Tracking Engine na Sprint 1. O banco só guarda o estado final, não a fila de tentativas.

### Falha 4: Deadlocks Financeiros
No Blueprint, o `Ledger` tem um trigger que atualiza `cached_balance` na tabela `Wallet`. Se 50 pessoas compram da mesma criadora no mesmo milissegundo, 50 threads tentam atualizar a MESMA linha da Wallet.
**Crítica:** Isso causará contenção massiva (Row Lock) e Deadlocks. O saldo não pode ser atualizado via trigger transacional síncrono em picos de vendas. A agregação deve ser Lazy (ou usar workers para debounce).

---

## 3. Event Architecture

### Falha 5: Onde está o Inbox Pattern?
A arquitetura detalha os eventos, mas falha em garantir a entrega (At-Least-Once Delivery). Se o banco salva o pedido (`OrderCreated`) mas o Redis falha ao registrar o evento antes do commit, o sistema não libera a compra e o evento se perde no vácuo.
**Crítica:** Falta o **Transactional Outbox Pattern**. Todo evento crítico deve ser gravado numa tabela `outbox_events` na *MESMA TRANSAÇÃO* que gravou a regra de negócio. Um worker assíncrono lê o outbox e garante a publicação para o Message Broker.

---

## 4. Tracking Engine & Identity Resolution (Perda de Dinheiro)

### Falha 6: O Buraco Negro do Cross-Device
O tracking atual presume que um visitante (`origin_ip`, `fingerprint`) será pareado com o `member_id` via `identities`. Mas e se o usuário clica no anúncio pelo 4G (Celular) e finaliza a compra no PC do trabalho? O IP e o Fingerprint mudam.
**Crítica:** O sistema atual perde a venda do Afiliado e o retorno da UTM se não usar **Linkagem por E-mail**. Se o e-mail preenchido no checkout (PC) bater com o e-mail de um lead (Celular), a atribuição tem que fazer o merge retrospectivo. O Tracking Engine está simplório demais para Cross-Device.

---

## 5. Finance & Security (Vetor de Fraude)

### Falha 7: Chargeback = Prejuízo Imediato
A regra diz que o `Ledger` é imutável. Um pagamento cai, o Ledger credita a modelo e o atendente. 15 dias depois o cartão dá Chargeback. Como o Ledger reage?
**Crítica:** Falta a mecânica de `Reversal` ou `Clawback`. O Ledger precisa ter um `entry_type` = `reversal`. Além disso, a "Wallet" precisa diferenciar `available_balance` (para saque) de `pending_balance` (dentro da janela de chargeback). Se não houver saldo pendente, a empresa paga o afiliado do próprio bolso.

### Falha 8: Race Condition de Saques
Se uma criadora usar um script que dispara 20 requisições `/withdraw` no mesmo centésimo de segundo, e a checagem de saldo não estiver usando `SELECT ... FOR UPDATE` (Pessimistic Lock), ela pode sacar 20x o mesmo valor.
**Crítica:** O Blueprint não menciona controle de concorrência pessimista (Pessimistic Concurrency Control) para saques. É um vetor de fraude crítico.

---

## 6. Performance & Escalabilidade

### Falha 9: A Lentidão do Feed (Only)
A tabela `only_posts` aponta para mídias (JSON ou junção). Se uma criadora tem 10 mil assinantes e posta um vídeo, 10 mil pessoas atualizam o feed. Fazer JOIN no `only_post_access` para checar acesso por request é O(N).
**Crítica:** A permissão de acesso tem que morar no Token (JWT) do usuário ou no Redis (`access:{member_id}:{creator_id}`). O banco não pode resolver ACL de feed em tempo de leitura sob carga alta. Consultas de feed precisam ser O(1) com Redis.

---

## 7. Produto e ROI (A Visão Comercial)

### Falha 10: Ofertas Dinâmicas (Dynamic Pricing) e Up-sells Fixos
A arquitetura tem `product_prices`, o que sugere preços estáticos. Como o Sales Engine fará um "One-Click Upsell" de 50% de desconto SE o cliente já gastou R$ 1000?
**Crítica:** Faltam entidades comerciais fluidas como `Offer` e `CheckoutSession`. O preço não deve vir engessado do produto, mas sim da *Oferta* que foi gerada pelo Sales Engine baseada no perfil (CRM) do cliente no momento do clique. Sem isso, o LTV fica engessado.

---

## 8. Relatório de Riscos e Tabela de Prioridades

| Problema | Gravidade | Impacto Financeiro | Complexidade de Correção | Prioridade |
| :--- | :---: | :--- | :---: | :---: |
| **Deadlocks no Ledger via Trigger** | Crítica | Alto (Pagamentos travados em picos) | Baixa (Mudar trigger para lazy/worker) | 1 |
| **Race Condition no Saque (Wallet)** | Crítica | Alto (Fraude / Saque Duplo) | Baixa (Adicionar `FOR UPDATE` no código) | 1 |
| **Falta de Outbox Pattern (Perda Eventos)**| Crítica | Alto (Comissões e tracking perdidos) | Média (Adicionar tabela e worker) | 1 |
| **Tabela Polimórfica Global (Ownership)**| Alta | Médio (Dívida Técnica que impede escala) | Baixa (Mover colunas pros módulos) | 2 |
| **PG como fila primária de Analytics** | Alta | Médio (Queda de performance geral do BD)| Alta (Introduzir Redis Streams pro Tracking)| 2 |
| **Cross-Device Tracking falho** | Alta | Alto (ROI de Ads medido errado) | Média (Refinar Identity Resolution) | 2 |
| **Falta de Ledger Reversals (Chargeback)**| Alta | Alto (Plataforma assume prejuízos) | Média (Adicionar `Reversal` no schema) | 2 |
| **Falta de Entidade `Offer` no Sales** | Média | Alto (Menor conversão em funis de up-sell)| Média (Refatorar Products/Prices) | 3 |
| **ACL (Acesso) do Feed no PostgreSQL** | Média | Baixo (Mas alto custo de infraestrutura)| Média (Mover cache de ACL pro Redis) | 3 |

---

## NOTA DE ARQUITETURA FINAL: 6.5 / 10

**Conclusão do Auditor:**
O modelo de negócios e o mapeamento de domínios estão excepcionais (Nota 9). Contudo, as **escolhas táticas de banco de dados e sincronia de eventos estão ingênuas** (Nota 4) para uma operação de alta volumetria financeira.

Se implementada como está, a plataforma rodaria perfeitamente no dia 1. Mas no mês 6, durante uma grande campanha de Ads (Black Friday), o banco de dados travaria por contenção (Row Locks no Ledger) ou inchaço (VACUUM no system_jobs), as vendas não contabilizariam direito por quebra de Tracking Cross-Device, e a empresa absorveria o prejuízo dos Chargebacks não conciliados.

### Correções OBRIGATÓRIAS antes do SQL:
1. Eliminar a tabela global `Ownership` e colocar as foreign keys diretamente onde pertencem (ex: `members.acquisition_affiliate_id`).
2. Trocar o conceito de `Job Queue no PG` por uma tabela `outbox` padrão para enviar mensagens de forma transacional a um Redis real.
3. Adicionar o conceito de `pending_balance` e `Reversal` no Ledger.
4. Adicionar a entidade `Offer` ao invés de depender apenas de `Price` fixo.