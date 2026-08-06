# ADR 001: Soft References para Transaction ID no Finance Ledger

**Data:** 2026-08-05
**Status:** Aceito (Architecture Freeze v1.0)
**Domínio:** `finance.ledger`

## 1. Contexto
A tabela `finance.ledger` é o coração financeiro da plataforma, gravando cada centavo movimentado através do modelo *Double-Entry Bookkeeping*.
A tabela é particionada temporalmente e projetada para escalar na casa dos bilhões de registros.
Durante a revisão de design (Pre-SQL Audit), identificou-se que manter uma `FOREIGN KEY` (Restrição de Chave Estrangeira) do `ledger` apontando para a tabela `finance.transactions` criaria um gargalo gravíssimo de *Lock Contention* (Global Shared Locks) no PostgreSQL. Isso destruiria a escalabilidade horizontal de gravações sob alto paralelismo.

## 2. Decisão
1. **Remoção Parcial de FK:** A coluna `transaction_id` na tabela `finance.ledger` será uma **Soft Reference**. O campo existirá estruturalmente como `UUID NOT NULL`, suportado por um índice B-Tree, mas **NÃO** terá uma constraint física `FOREIGN KEY` associada no PostgreSQL.
2. **Manutenção de FK Crítica:** A `FOREIGN KEY` para a conta envolvida (`wallet_id`) foi **mantida**, garantindo que dinheiro nunca seja creditado em uma carteira inexistente.

## 3. Consequências e Trade-offs
**Positivas:**
*   Eliminação do *Shared Lock* na tabela de transactions durante inserções massivas.
*   Crescimento linear de TPS (Transactions Per Second), limitado apenas pelo I/O do disco (Append-Only).
*   Redução drástica do *Write Amplification*.

**Negativas (Riscos):**
*   Existe a possibilidade teórica de um "registro órfão" (um `transaction_id` existir no Ledger sem existir na tabela `finance.transactions`), caso o pacote transacional (ACID) na camada de aplicação falhe bizarramente sem executar o *Rollback* correto.

## 4. Mitigação Obrigatória (Reconciliação Permanente)
Para cobrir o risco aceito nesta ADR, fica **arquiteturalmente obrigatória** a implementação de um mecanismo de reconciliação assíncrona.
*   **Rotina:** Um *Worker/Cron* rodará periodicamente (ex: a cada hora ou fim de dia) para buscar assimetrias entre os registros de `finance.ledger` e `finance.transactions`.
*   **Regra de Ouro:** Qualquer orfandade detectada (`transaction_id` no ledger que não exista fisicamente na `finance.transactions`) disparará um **Erro Crítico de Integridade Financeira (P0 Alert)**. A divergência deverá ser resolvida imediatamente pela equipe de engenharia.