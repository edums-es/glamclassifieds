# Arquitetura e Engenharia de Produto: The Sex Only (Revenue-First & CRM Core)

## 1. Visão de Produto e Negócio (Revenue-First)
O objetivo principal é construir uma **Máquina de Vendas Orientada a Dados e CRM Interno**. A plataforma deve maximizar conversão, retenção e ticket médio, mantendo o custo de infraestrutura inicial otimizado.

A arquitetura prioriza:
1.  **Mensuração Total (Tracking):** Cada interação (clique, tempo online, views) gera um evento rastreável.
2.  **CRM Nativo e Granular:** Painéis detalhados por Cliente, Atendente e Modelo, substituindo ferramentas externas.
3.  **Flexibilidade Extrema de Comissionamento:** Motor de regras configurável 100% via painel administrativo.
4.  **Modularidade Isolada:** Estrutura escalável onde "The Sex Only" é apenas um módulo plugável.
5.  **Data-Ready (Preparado para IA Futura):** Armazenamento estruturado de comportamento hoje, sem o custo/complexidade de implementar IA agora.

---

## 2. Arquitetura Modular (Isolamento de Domínio)

O sistema abandonará o formato monolítico tradicional e adotará uma **Arquitetura Baseada em Componentes/Módulos** (Modular Monolith). Cada domínio tem suas próprias rotas, modelos e serviços.

### Estrutura de Diretórios Sugerida:
*   `Modules/Auth/` (Login, Registro, Sessões)
*   `Modules/Classifieds/` (O projeto original de classificados)
*   `Modules/Only/` (Conteúdo privado, Assinaturas, Posts, Mídia)
*   `Modules/Finance/` (Ledger, Saques, Gateway de Pagamento)
*   `Modules/Commissions/` (Motor de Regras, Distribuição)
*   `Modules/CRM/` (Perfis 360, Transições de Estado, Ciclo de Vida)
*   `Modules/Analytics/` (Ingestão de Eventos, Tracking, Dashboards)
*   `Modules/Affiliates/` (Atendentes, Links, Atribuição)
*   `Modules/Recovery/` (Fila de abandono de carrinho, Automações de resgate)

*Comunicação entre módulos:* Um módulo só pode conversar com outro via Serviços ou Eventos (Event Dispatcher), nunca acessando a tabela do outro diretamente.

---

## 3. Arquitetura de Eventos e Analytics (O Coração do CRM)

Para rastrear absolutamente tudo sem derrubar o banco transacional, implementaremos um **Event Tracker Assíncrono**.

1.  O Frontend dispara eventos estruturados.
2.  Um endpoint leve (`/api/v1/analytics/track`) enfileira o evento (Redis).
3.  Um *Worker* consolida esses eventos no Banco de Dados (PostgreSQL/MySQL particionado) para gerar o CRM.

### Eventos Rastreados (Dicionário de Dados)
*   **Usuários:** `UserRegistered`, `UserLoggedIn`, `UserSessionHeartbeat` (tempo online).
*   **Navegação:** `ProfileViewed` (com Duração), `MediaOpened`, `VideoWatched` (com % de retenção), `ButtonClicked`.
*   **Checkout:** `CheckoutStarted`, `CheckoutAbandoned`, `PaymentCompleted`, `PaymentFailed`.
*   **Conteúdo & Financeiro:** `SubscriptionCreated`, `SubscriptionRenewed`, `SubscriptionCanceled`, `PpvPurchased`, `TipSent`.

---

## 4. CRM 360º (Painel Administrativo)

O Painel Administrativo servirá como um verdadeiro CRM para os gestores, segmentado em 3 visões principais.

### 4.1. CRM do Cliente (Histórico Completo)
Tabela central `crm_customer_profiles` unifica:
*   **Aquisição:** Origem, Campanha, Atendente (Atribuição First-Touch e Last-Touch).
*   **Jornada (State Machine):** Cadastro -> Assinatura -> Renovação -> VIP -> Churn.
*   **Métricas Financeiras:** Total Gasto, LTV, Ticket Médio.
*   **Comportamento:** Último acesso, tempo total na plataforma, último vídeo assistido, % de abandono de checkout.

### 4.2. CRM do Atendente (Eficiência e LTV)
Avalia quem traz o melhor cliente, não apenas volume.
*   **Funil de Vendas:** Cliques -> Cadastros -> Checkouts -> Conversões.
*   **Métricas de Qualidade:** LTV Médio dos clientes trazidos, Taxa de Retenção (Mês 2), Taxa de Recuperação de Carrinho.
*   **Métricas Financeiras:** Receita Gerada, Comissão Prevista vs Paga, ROI.

### 4.3. CRM da Criadora/Modelo (Performance)
*   **Conversão:** Taxa de conversão do Perfil (Views vs Assinaturas).
*   **Retenção:** Churn Rate, Tempo médio de assinatura.
*   **Receita Múltipla:** Assinaturas vs PPV, Melhores Campanhas/Atendentes.

---

## 5. Motor de Comissões e Regras (Totalmente Configurável)

Nenhum percentual ficará no código. Teremos um motor de regras lógicas operando no `Modules/Commissions/`.

*   **Tabela `commission_rules`:**
    *   `id`, `name`, `priority`, `conditions` (JSON), `percentage`, `fixed_amount`, `is_active`.
*   **Como funciona:**
    *   A condição (JSON) dita a regra. Ex: `{"transaction_type": "subscription", "is_recurring": true}` -> `percentage: 5%`.
    *   Outro Ex: `{"origin": "recovery_engine"}` -> `percentage: 8%`.
    *   O painel Admin terá uma interface visual (Construtor de Condições) para adicionar, remover ou alterar prioridades sem deploy de código.

---

## 6. Recuperação de Vendas e Funis

A tabela `recovery_campaigns` gerencia tentativas ativas de salvar receitas.

1.  O módulo Analytics detecta `CheckoutAbandoned`.
2.  Dispara evento para o módulo Recovery.
3.  Recovery cria uma `recovery_task` no banco, agenda contatos (via e-mail, webhook para WhatsApp) e notifica o Atendente no CRM.
4.  Se a venda ocorrer, a `transaction_attribution` é marcada com a origem do resgate, e o Motor de Comissões aplica a regra específica.

---

## Próximo Passo
Esta arquitetura atinge o objetivo: **Custo inicial baixo (monolito modular com filas no Redis) e inteligência de negócio nativa, totalmente preparado para virar base de treino de IA no futuro.**

Deseja que eu crie a especificação das **Estruturas de Tabelas (Esquema SQL)** para o módulo de CRM e Analytics, focando nessa captura granular de dados?