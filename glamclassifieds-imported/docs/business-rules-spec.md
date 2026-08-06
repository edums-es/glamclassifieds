# Especificação de Regras de Negócio (Business Rules Specification)

## 1. Dicionário de Entidades e Papéis

- **Visitante (Guest):** Usuário não autenticado navegando na plataforma.
- **Membro (Member/Lead):** Usuário autenticado que pode consumir conteúdo gratuito, interagir, mas não possui transações financeiras ativas.
- **Assinante (Subscriber):** Membro com pelo menos uma assinatura ativa ou compra de PPV/Pack.
- **VIP:** Assinante que atingiu um LTV (Lifetime Value) ou métrica específica (configurável) de alto valor.
- **Criadora (Creator/Modelo):** Membro autorizado a vender assinaturas, postar conteúdo pago/gratuito e receber gorjetas (tips).
- **Atendente (Affiliate/Partner):** Parceiro focado em gerar tráfego e conversão através de links rastreáveis, remunerado por comissões.
- **Administrador (Admin):** Usuário com acesso ao CRM interno, criação de regras de comissão e aprovação de saques.

---

## 2. Máquina de Estados e Ciclo de Vida (CRM)

### 2.1. Estados do Cliente (Customer Lifecycle)
Um membro percorre um funil de status unidirecional, podendo retornar a estados de reengajamento.
*   **Lead:** Conta criada, e-mail confirmado, nenhuma compra iniciada.
*   **Warm Lead:** Iniciou um checkout (abandono), mas não concluiu.
*   **Active Subscriber (New):** Concluiu a primeira compra.
*   **Active Subscriber (Recurring):** Possui renovações bem-sucedidas.
*   **VIP:** LTV acumulado superior à regra X ou ativo por mais de Y meses ininterruptos.
*   **At Risk (Risco de Churn):** Assinatura ativa, mas cartão falhou na tentativa de renovação (em período de *grace*).
*   **Churned (Cancelado):** Assinatura expirada ou cancelada manualmente.
*   **Reactivated:** Cliente que estava em "Churned" e realizou nova compra.

### 2.2. Estados da Transação Financeira (Invoice/Transaction)
*   **Pending:** Gerada no sistema, aguardando resposta do gateway.
*   **Completed:** Pagamento confirmado pelo gateway. Valores disponíveis para divisão (Split).
*   **Failed:** Pagamento recusado (saldo insuficiente, fraude).
*   **Refunded:** Estorno solicitado e aprovado.
*   **Chargeback:** Disputa no cartão de crédito (gera penalidade e bloqueio automático do membro).

---

## 3. Regras de Atribuição (Attribution Engine)

A regra de atribuição define **quem ganha o crédito** por uma venda (e consequentemente, a comissão).

*   **Cookie/Sessão First-Touch e Last-Touch:** O sistema grava o ID do Atendente/Afiliado no primeiro clique (First-Touch) e no clique imediatamente anterior à conversão (Last-Touch).
*   **Regra de Sobrescrita de Atendente:** Um clique novo no link do Atendente B sobrescreve o Atendente A se a janela de conversão (ex: 30 dias) não houver gerado venda para A.
*   **Atribuição Vitalícia (Sticky Referral):** Se configurado nas regras de negócio, o cliente que assinou a Criadora Y através do Atendente X gerará comissões recorrentes para o Atendente X enquanto a assinatura durar, mesmo que a renovação ocorra sem clique no link.
*   **Prioridade de Recuperação:** Se uma venda ocorrer através de um link disparado pela "Máquina de Recuperação" (E-mail/WhatsApp), a atribuição marca a venda como *Origem: Recovery*, mantendo o *Affiliate_ID* original, mas submetendo a venda a uma regra de comissão diferente.

---

## 4. Regras de Comissionamento e Distribuição (Split)

O sistema financeiro não possui taxas fixas no código (hardcoded). A divisão obedece ao "Motor de Regras", processado de cima para baixo por **Prioridade**.

### 4.1. Exemplos de Regras (A serem configuradas no Admin)
*A soma deve sempre deduzir a taxa do gateway e dividir o restante (Net Revenue).*

1.  **Venda Direta (Orgânica - Sem Atendente):**
    *   *Condição:* Affiliate = null
    *   *Divisão:* Criadora (80%), Plataforma (20%).
2.  **Venda via Atendente (Nova Assinatura):**
    *   *Condição:* Affiliate = not_null AND TransactionType = "new_sub"
    *   *Divisão:* Criadora (70%), Atendente (15%), Plataforma (15%).
3.  **Renovação Automática via Atendente:**
    *   *Condição:* Affiliate = not_null AND TransactionType = "renewal"
    *   *Divisão:* Criadora (75%), Atendente (10%), Plataforma (15%).
4.  **Venda via Recuperação de Carrinho:**
    *   *Condição:* Origin = "recovery_auto"
    *   *Divisão:* Criadora (70%), Atendente (8%), Plataforma (22% - custo do resgate).
5.  **Venda PPV (Pay-Per-View/Mídia Avulsa):**
    *   *Condição:* ProductType = "ppv"
    *   *Divisão:* Criadora (80%), Atendente (10%), Plataforma (10%).

*Regra Dourada:* Sempre que uma transação (Completed) entra no sistema, o "Split Engine" lê o contexto da venda, encontra a regra aplicável e registra as entradas no *Ledger* (Livro-Razão) imutável.

---

## 5. Fluxos de Recuperação de Vendas (Recovery Engine)

A plataforma trabalha ativamente para não perder receita.

### 5.1. Abandono de Checkout (Cart Abandonment)
*   **Gatilho:** Evento `CheckoutStarted` não seguido por `CheckoutCompleted` em X minutos.
*   **Ação 1 (T + 30 min):** Envio automático de E-mail/Notificação "Você esqueceu algo?".
*   **Ação 2 (T + 2 horas):** E-mail com escassez.
*   **Ação 3 (T + 24 horas):** O sistema aplica um "Cupom Fantasma" de 15% na sessão do usuário e notifica: "Desconto liberado por 2 horas".
*   **Ação Humana:** Se o cliente possuir status "Warm Lead", a tarefa aparece na fila do CRM do Atendente original para contato manual via WhatsApp.

### 5.2. Falha na Renovação (Dunning Process)
*   **Gatilho:** Gateway retorna falha ao tentar cobrar a recorrência.
*   **Período de Graça (Grace Period):** O acesso do cliente é mantido por 3 dias.
*   **Ação (Automática):** O sistema tenta recobrar nos dias 1, 3 e 5. E-mails e pop-ups na plataforma avisam o usuário sobre a falha de pagamento.
*   **Churn:** Se não pago após o dia 5, o estado muda para `Churned` e o acesso ao conteúdo exclusivo é revogado.

---

## 6. Motor de Eventos e Analytics (Tracking Exaustivo)

Todas as ações descritas abaixo são transformadas em pacotes JSON e enviadas ao barramento de eventos (Analytics/Data Warehouse) para montagem do CRM e cálculos de LTV/Conversão.

### 6.1. Eventos de Topo de Funil (Aquisição)
*   `Pageview` (Path, Referrer, UTMs, Affiliate ID).
*   `ProfileVisited` (Creator ID, Tempo de permanência).
*   `MediaPreviewed` (Foto/Vídeo borrado clicado).

### 6.2. Eventos de Meio de Funil (Engajamento)
*   `PostLiked`, `PostCommented`.
*   `MessageSent` (Creator ID -> Member ID ou vice-versa).
*   `VideoPlayed` (Duração assistida em %, para medir qualidade do conteúdo).
*   `SessionHeartbeat` (Disparado a cada 60s para medir tempo real online).

### 6.3. Eventos de Fundo de Funil (Receita)
*   `CheckoutInitiated` (Produto, Preço).
*   `PaymentMethodAdded` (Cartão salvo).
*   `PurchaseCompleted` (Gera evento de Ledger).
*   `PurchaseFailed` (Motivo da recusa).
*   `SubscriptionCanceled` (Motivo preenchido no formulário de saída).

---

## 7. Regras de Moderação e Compliance

*   **KYC (Know Your Customer):** Criadoras não podem receber pagamentos (Payouts) até que documentos (Identidade + Selfie) sejam aprovados pelo Admin. Contas não verificadas têm saques bloqueados.
*   **Delay de Saque (Hold Period):** Para evitar fraudes de Chargeback, o saldo proveniente de assinaturas com cartão de crédito fica bloqueado por "X" dias antes de ser liberado para saque (ex: D+14).
*   **Banimento (Bans):** Usuários que abrem disputas no cartão de crédito (Chargeback) são banidos automaticamente (`status = banned`), bloqueando IP, e-mail e hash do cartão para compras futuras.
