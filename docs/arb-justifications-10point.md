# Justificação Técnica - Correções ARB (Architecture Review Board)

Este documento detalha a justificativa de negócio e engenharia para as 4 correções críticas apontadas pela auditoria de arquitetura, visando atingir o "Architecture Freeze v1.0". 
Nenhuma abstração foi adicionada sem cumprir requisitos estritos de performance, segurança, rastreabilidade ou ROI.

---

## 1. Tratamento de Concorrência Massiva (Deadlocks e Race Conditions)

**1. Qual é o problema identificado:**
a) Triggers transacionais síncronos no Ledger atualizando saldos das carteiras (Wallets) geram contenção (Row Lock) em picos de vendas para o mesmo criador/afiliado.
b) Ausência de concorrência pessimista em saques (`/withdraw`) abre brecha para fraude (Race Conditions permitindo saques duplos).

**2. Em qual documento ele aparece:**
- `Database Blueprint` (Sessão do Finance).
- `Business Rules` (Regras de Saque e Comissionamento).

**3. Qual o risco real em produção:**
Em campanhas de alto volume (ex: Black Friday, lançamento de pack com desconto), o banco sofre Lock de milhares de transações tentando atualizar a mesma linha em `wallets` simultaneamente. Ocorrem falhas em cascata no checkout devido a *Timeout* transacional do PostgreSQL. No saque, o risco é o esvaziamento malicioso do caixa da empresa.

**4. Em qual cenário esse problema aconteceria:**
a) Um influenciador de 1 milhão de seguidores posta um link de promoção, gerando 5.000 compras em 2 minutos.
b) Script automatizado dispara 20 requisições simultâneas de saque na mesma fração de segundo.

**5. Qual seria o impacto financeiro e operacional:**
Pagamentos não são processados por timeouts de banco (perda de conversão em momento de pico). Prejuízo financeiro direto por fraudes de saque, drenando o caixa.

**6. Qual é a solução proposta:**
a) **Para Deadlocks:** Remover triggers de atualização de saldo síncronos. O saldo em cache da Wallet passará a ser atualizado de forma *Eventual* (assíncrona) via *Workers* ou através de *Lazy Evaluation* (calculado na leitura sob demanda a partir do Ledger imutável).
b) **Para Fraudes:** Introduzir `SELECT ... FOR UPDATE` (Pessimistic Locking) na tabela de Wallets durante qualquer transação de saque, bloqueando leituras/escritas concorrentes até o fim da transação.

**7. Quais módulos serão afetados:**
- Finance (`Ledger`, `Wallets`, `Transactions`).

**8. Qual o custo de implementação:**
Baixo/Médio. Alteração na infraestrutura do ORM/Queries SQL (remover trigger e adicionar sintaxe de lock na rotina de saque). O custo de complexidade é mínimo, e o benefício é colossal.

**9. Se essa alteração quebra alguma decisão anterior:**
Sim, quebra a decisão de usar Triggers no banco para atualização de saldo cache.

**10. Como validar que o problema realmente foi resolvido:**
Testes de Carga/Stress (ex: JMeter/K6) simulando 10.000 compras simultâneas para um único recebedor (monitorar logs por erros de *Deadlock/Timeout*). Testes com scripts multi-threading disparando requisições paralelas de saque (verificar se o saldo nunca fica negativo e o saque falha para as requests concorrentes).

**Critério Atendido:** Aumentar confiabilidade; Reduzir risco financeiro.

---

## 2. Abandono do Polimorfismo Global ("Ownership")

**1. Qual é o problema identificado:**
O uso de uma tabela polimórfica genérica e global (`entity_type`, `owner_type`) para gerenciar "quem é dono de quem" (Afiliados, Clientes, Criadores, Vendedores).

**2. Em qual documento ele aparece:**
- `Platform Domain Model` (Bounded Context do CRM/Core).
- `Database Blueprint` (Tabela genérica de Ownership).

**3. Qual o risco real em produção:**
Perda da Integridade Referencial no banco de dados. Bancos relacionais não suportam Foreign Keys (FKs) fortes em designs polimórficos, impossibilitando garantias estruturais (Cascade Deletes, constraints). Cria lentidão extrema (Full Table Scans) ao buscar relatórios (ex: "Quais são os clientes deste afiliado?").

**4. Em qual cenário esse problema aconteceria:**
Ao rodar relatórios de faturamento mensais ou relatórios de comissionamento de rede, a engine do PostgreSQL teria que cruzar tabelas de strings, inutilizando índices, derretendo CPU. Inconsistência de dados caso um "Dono" seja removido e o filho fique órfão sem o banco perceber.

**5. Qual seria o impacto financeiro e operacional:**
Relatórios lentos travando banco de produção (impacto no checkout indireto). Comissões pagas para afiliados errados/inexistentes (vazamento de caixa) devido à quebra de FKs.

**6. Qual é a solução proposta:**
Mover os campos de atribuição de propriedade diretamente para as entidades de negócio usando Foreign Keys explícitas e tipadas. Ex: `core.members` ganha as colunas `acquisition_affiliate_id`, `current_manager_id`. `commerce.orders` ganha `referred_by_id`.

**7. Quais módulos serão afetados:**
- Core, Commerce, Sales. (A Tabela polimórfica será sumariamente eliminada).

**8. Qual o custo de implementação:**
Custo nulo de implementação técnica (design relacional clássico). Ganho colossal de clareza mental e documentação.

**9. Se essa alteração quebra alguma decisão anterior:**
Sim. Quebra a ideia de tentar centralizar Atribuição de Customer Success em um módulo abstrato, puxando a atribuição para a própria entidade.

**10. Como validar que o problema realmente foi resolvido:**
Confirmar a presença das Foreign Keys estritas nos scripts SQL finais e sucesso em simular Deleção em Cascata (ou Restrição) de registros, com o banco garantindo a integridade.

**Critério Atendido:** Aumentar rastreabilidade; Aumentar performance.

---

## 3. Arquitetura de Eventos Segura (Transactional Outbox)

**1. Qual é o problema identificado:**
Ausência de garantia "At-Least-Once Delivery" na emissão de eventos. Eventos sendo gravados ou despachados para um Message Broker logo após ou junto a transações sem consistência. (Também resolve o problema de usar o PG apenas como fila de analytics).

**2. Em qual documento ele aparece:**
- `Platform Domain Model` (Seção de Eventos).
- `Database Blueprint` (Ausência de Tabela Outbox).

**3. Qual o risco real em produção:**
Falha na rede ou queda do Message Broker (Redis/RabbitMQ) entre o "Commit" no banco transacional e o "Publish" do evento. Um pedido é criado e faturado, mas o evento `SubscriptionCreated` se perde no limbo, logo, o usuário não ganha acesso.

**4. Em qual cenário esse problema aconteceria:**
Sempre que ocorrerem picos de uso da infraestrutura que levem a timeouts temporários nas conexões TCP com o Message Broker ou Cache.

**5. Qual seria o impacto financeiro e operacional:**
Geração massiva de chamados no suporte ("Paguei mas não liberou"), aumento agudo na taxa de Chargebacks por insatisfação. Desgaste da marca com afiliados (Eventos de conversão perdidos = comissões não pagas).

**6. Qual é a solução proposta:**
Implementação do **Transactional Outbox Pattern**. Dentro da mesma transação do banco (ACID) em que os dados da venda são gravados, gravar o evento em uma tabela `system.outbox_events`. Uma Worker local lê essa tabela (asynchronous polling ou logical decoding - WAL) e garante o disparo, marcando como concluído.

**7. Quais módulos serão afetados:**
- Módulo Core/System (novo schema para fundação de eventos). Todos os fluxos de gravação essenciais passam a gravar na Outbox.

**8. Qual o custo de implementação:**
Médio. Exige adicionar uma tabela transacional leve, padronizar o Repository/ORM para envelopar as chamadas numa Transaction envolta, e um Worker Daemon simples. O custo é pago facilmente pela ausência de falhas silenciosas.

**9. Se essa alteração quebra alguma decisão anterior:**
Substitui o disparo assíncrono síncrono ingênuo e diminui a necessidade de manter logs gigantes no próprio banco, pois o outbox pode ser limpo constantemente (apenas enfileira).

**10. Como validar que o problema realmente foi resolvido:**
Testes de Chaos Engineering (ex: derrubar o Redis/RabbitMQ por 5 minutos enquanto compras ocorrem). Ao restaurar o Redis, o Worker deve recuperar a tabela `outbox_events` e processar 100% dos eventos acumulados, sem perda de acessos e tracking.

**Critério Atendido:** Aumentar confiabilidade; Reduzir custo operacional (suporte).

---

## 4. Reconciliação e Resolução de Identidade (Tracking & Chargebacks)

**1. Qual é o problema identificado:**
a) O sistema assume que `member_id` é suficiente para tudo, quebrando atribuições quando o usuário visita no mobile (Anônimo, gera UTM) e compra no Desktop (Sem UTM).
b) Ausência do estado `Pending` e `Reversal` no Ledger para tratar Chargebacks após a confirmação financeira.

**2. Em qual documento ele aparece:**
- `Business Rules` (Falta de mecânica de clawback, falta de Cross-Device rules).
- `Platform Domain Model` e `Database Blueprint` (Ausência das tabelas e status).

**3. Qual o risco real em produção:**
a) **Marketing:** Campanhas altamente rentáveis (mas cross-device) são lidas como não-rentáveis. O tráfego pago encarece por falta de conversões para retro-alimentar as IAs do Meta/Google Ads. 
b) **Financeiro:** Criadoras e afiliados sacam comissões na hora, o cartão vira Chargeback (15 dias depois), o Ledger fica rígido e a plataforma absorve 100% do prejuízo (Dinheiro sai do bolso da empresa).

**4. Em qual cenário esse problema aconteceria:**
a) Usuário descobre oferta pelo celular no ônibus (cadastra e-mail). Paga de noite no computador de casa usando o link do histórico. Afiliado original não recebe.
b) Fraudes de cartão de crédito. Compras massivas de assinatura e saques instantâneos antes da compensação e limpeza do Anti-Fraude.

**5. Qual seria o impacto financeiro e operacional:**
Perda massiva de ROI (Custo de Aquisição sobe por falta de inteligência). Risco existencial do negócio por vazamento de caixa absorvendo fraudes via Chargeback não rastreado.

**6. Qual é a solução proposta:**
a) **Cross-Device:** Adicionar entidade `trk_identities_merge` (Linkagem por e-mail/telefone). Se o sistema encontra um evento com um e-mail idêntico ou identificador via Server-Side API, ele une a sessão de celular original ao `member_id` e salva o afiliado.
b) **Ledger:** Introduzir `pending_balance` e `available_balance` nas Wallets. Entradas no Ledger geram Saldo Pendente (janela D+2 a D+30). Adicionar entrada `REVERSAL` (tipo de transação de débito no ledger que reverte créditos indevidos antes da liberação ou deduz futuros ganhos da modelo).

**7. Quais módulos serão afetados:**
- Tracking Engine (`Identities`, `Sessions`).
- Finance (`Ledger`, `Wallets`, Regras de Liberação de Saldo).

**8. Qual o custo de implementação:**
Médio a Alto, pois exige um job recorrente de "Clearance" (liberação de saldo vencido) e regras complexas no merge de sessões, mas essencialmente transforma a plataforma em algo blindado.

**9. Se essa alteração quebra alguma decisão anterior:**
Complexifica o tracking que era simples e altera a estrutura do Ledger.

**10. Como validar que o problema realmente foi resolvido:**
a) Gerar 2 sessões IPs diferentes com o mesmo e-mail e ver o `affiliate_id` da Sessão A sendo populado na compra feita na Sessão B.
b) Gerar uma transação de Chargeback simulada por API no dia D+2 de uma compra: o saldo pendente do afiliado e da modelo devem cair, e uma linha de REVERSAL ser registrada, sem permitir saque prévio.

**Critério Atendido:** Reduzir risco financeiro; Facilitar evolução futura (Modelos preditivos).