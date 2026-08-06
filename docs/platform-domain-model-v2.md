# Platform Domain Model V2 (Revenue OS)

Este documento representa a **Arquitetura Definitiva (Revenue OS)**, projetada com a mentalidade de CTO/Product Architect. O foco central é maximização de ROI, gestão granular de dados (Data Ready), eficiência de tráfego pago (Tracking) e retenção (Customer Success), eliminando qualquer complexidade que não gere valor comercial imediato.

A abordagem é **Modular Monolith** — construída para o presente (custo baixo) mas estruturada para o futuro (IA e escalabilidade isolada).

---

## 1. Catálogo de Módulos (Revisado & Otimizado)

O ecossistema foi refatorado para garantir princípio de responsabilidade única (SRP), fortalecendo Vendas, Tracking e Retenção.

### 1.1. Core & Identity (Acesso e Perfil)
*   **Auth:** Login, segurança, troca de senhas. *(Indispensável - Sprint 1)*
*   **Members:** Dados cadastrais, endereço. *(Indispensável - Sprint 1)*
*   **Permissions:** RBAC, perfis de acesso. *(Indispensável - Sprint 1)*

### 1.2. Commerce & Acquisition (O Motor de Receita Bruta)
*   **Products:** Catálogo, gestão de preços e tiers. *(Sprint 1)*
*   **Sales Engine (Otimizado):** Focado exclusivamente na extração máxima de LTV no momento da transação. Gerencia *Checkouts, Upsells 1-Click, Cross-sells e Order Bumps*. **Não faz marketing.** *(Sprint 1)*
*   **Orders:** Intenção de compra, carrinho, fechamento. *(Sprint 1)*
*   **Marketing:** Gestão de Campanhas (UTMs), Landing Pages, Cupons e Códigos Promocionais. *(Sprint 2)*
*   **Tracking Engine (Novo!):** Módulo Crítico. A única ponte entre a plataforma e redes de anúncios (Meta, Google, TikTok). *(Sprint 1)*
    *   *Funções:* Conversions API, Pixel, Deduplicação de Eventos, Consentimento (LGPD), Qualidade do Sinal.
    *   *Regra de Ouro:* Nenhum script de publicidade é colocado no *frontend* diretamente pelas views de outros módulos. Todos passam pelo GTM/Tracking Engine gerido aqui.
*   **Experiments (Testes A/B):** Gerencia variações de preço, layout e ofertas. Decide qual `Feature Flag` comercial o usuário X vai ver. *(Sprint 3)*

### 1.3. Financial & Revenue Split (Distribuição Segura)
*   **Payments:** Integração com Gateway (PIX, Cartão). Processa e recebe webhooks. *(Sprint 1)*
*   **Finance:** Converte pagamentos em acessos (Invoices, Subscriptions). *(Sprint 1)*
*   **Ledger:** O cofre. Livro-razão imutável de duplo lançamento. *(Sprint 1)*
*   **Commissions:** Motor de regras de Split. Resolve quem ganha quanto. *(Sprint 1)*
*   **Wallet:** Projeção de saldos e controle de saques/hold financeiro. *(Sprint 2)*

### 1.4. Retention & CRM (A Máquina de LTV)
*   **CRM (Comercial Integrado):** O painel mestre de inteligência. Cruza todos os dados para visualizações de *Atendente, Modelo, Cliente e Carteira*. *(Sprint 2)*
*   **Customer Success (Novo!):** Age APÓS a venda. Dedicado a Retenção, Renovações, Redução de Churn e reativação manual. *(Sprint 2)*
*   **Recovery:** Automações de abandono de carrinho (antes da venda/logo após falha). *(Sprint 2)*
*   **Gamification:** Gamifica o trabalho dos atendentes (Metas, Bônus, Ranking) para aumentar produtividade. *(Sprint 3)*
*   **Analytics:** Ingestão de dados brutos comportamentais (Tempo de tela, Heatmaps simples em formato de log). *(Sprint 3 - Antes apenas coletamos no log, aqui consolidamos em Dashboards).*

### 1.5. Content & Media (O Produto)
*   **Only:** Perfis das modelos, posts pagos/gratuitos. *(Sprint 1)*
*   **Classifieds:** Anúncios convencionais. *(Sprint 1)*
*   **Media:** Storage (S3), blur-hash, encoding. *(Sprint 1)*

### 1.6. Foundation (A Base Flexível)
*   **Settings:** Todas as regras, percentuais e limites configuráveis pelo painel. *(Sprint 1)*
*   **Feature Flags:** Liga/desliga funções do sistema instantaneamente. *(Sprint 1)*
*   **Ownership (Novo conceito centralizado):** Tabela polimórfica que rastreia transferências de propriedade (ex: Cliente que trocou de Atendente). *(Sprint 1)*
*   **Notifications:** Envio de E-mail/WhatsApp/SMS. *(Sprint 2)*

---

## 2. O Módulo: Tracking Engine (Destaque)

Para garantir máxima performance de anúncios, este módulo atua como um tradutor universal de dados (Event Translator).

### 2.1. Fluxo de Evento Limpo e Deduplicado
1.  **O que acontece:** Um pedido foi finalizado (Evento `OrderCompleted`).
2.  **Onde bate:** O módulo *Analytics* guarda para histórico interno. O *Tracking Engine* entra em ação para o mundo exterior.
3.  **Processamento Interno (`TrackingTranslatorService`):**
    *   Formata para Meta CAPI (Gera `Event ID` único para deduplicar com o Pixel do frontend). Mapeia como `Purchase` com `value`, `currency`, e hashes de e-mail/telefone do `Member`.
    *   Formata para GA4 via Measurement Protocol. Mapeia como `purchase` com `transaction_id`.
    *   Formata para TikTok API. Mapeia como `CompletePayment`.
4.  **Monitor de Qualidade:** O módulo salva logs do *Payload* enviado e do retorno da rede (HTTP 200/400). Se a Meta CAPI retornar "Erro de deduplicação" ou "Email Missing", o *Tracking Health Dashboard* no admin fica amarelo/vermelho.

---

## 3. Matriz de Ownership (Atribuição Rígida)

No CRM e na distribuição de comissões, o dono de um objeto importa mais que a venda em si. 

*   **Member (Lead/Cliente):**
    *   `AcquisitionOwner`: Atendente que trouxe (First touch).
    *   `CurrentOwner`: Atendente/Conta CS que cuida dele agora (Carteira).
*   **Creator (Modelo):**
    *   `AgencyOwner`: Conta do empresário/agência que tem direito a um % base.
    *   `RecruiterOwner`: Atendente que prospectou a modelo.
*   **Recovery Task / CS Ticket:**
    *   `AssignedOwner`: O humano do CS responsável por recuperar.
*   **Campaign (UTM/Landing Page):**
    *   `CreatorOwner`: O Atendente que criou a UTM/Cupom.

---

## 4. O que removi ou modifiquei após a revisão crítica?

1.  **Redução de Complexidade:** O módulo *Affiliates* foi absorvido. Gerenciar "Afiliados" é na verdade gerenciar a Atribuição de Origem (UTMs/Links). O Tracking Engine e o Sales Engine resolvem isso melhor.
2.  **Marketing vs Vendas:** Separados. *Marketing* atrai. *Sales Engine* espreme até a última gota de receita no Checkout.
3.  **CRM vs Customer Success:** CRM é visão/relatório/painel (Gestão Comercial). Customer Success é Ação (Tickets de renovação, Réguas de Churn, Contato humano de reativação).

---

## 5. Estratégia de Escalabilidade (Rollout Sprints)

Não vamos construir a "Estrela da Morte" no primeiro dia. Construímos o esqueleto e preenchemos os órgãos vitais.

### SPRINT 1: "Cash Flow Core" (O Mínimo para Faturar Muito)
*O foco é capturar dados, colocar dinheiro para dentro, dividir o dinheiro e rastrear para o tráfego.*
- Auth, Members, Permissions
- Classifieds, Only, Media (O Produto)
- Products, Orders, Payments, Finance, Ledger, Commissions (O Dinheiro)
- Tracking Engine (Obrigatório para ROI do tráfego pago imediato)
- Settings, Feature Flags, Ownership (A Base)

### SPRINT 2: "Retention & CRM" (A Máquina de LTV)
*O dinheiro já entra. Agora vamos impedir que ele saia e organizar a gestão.*
- CRM (Dashboards de Atendente, Modelo e Carteira)
- Customer Success (Gestão de renovação, Reativação)
- Recovery (Máquina de abandono de carrinho)
- Wallet (Liberação de saques para painel)
- Marketing (Gestão de campanhas, Cupons avançados)
- Notifications (Réguas automatizadas)

### SPRINT 3: "Growth & Optimization" (Escalando a Operação)
*A base e a retenção estão sólidas. Hora de otimizar milésimos de conversão.*
- Experiments (Testes A/B nativos)
- Gamification (Sistema de metas/pontos para Atendentes)
- Analytics (Dashboards analíticos avançados de BI). *Nota: Na Sprint 1 os eventos já são salvos em logs passivos, mas aqui construímos as views visuais pesadas.*

---
*A Planta de Arquitetura foi reajustada com visão de negócios (Revenue OS).* 
*O próximo passo técnico, se aprovado, é gerar o banco de dados (schema.sql) estritamente limitado à SPRINT 1, garantindo que todas as tabelas suportem as abstrações futuras (ex: tabelas prontas para Ownership e Eventos).*