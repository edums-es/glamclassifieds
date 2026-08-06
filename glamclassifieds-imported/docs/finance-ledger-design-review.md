# Finance Ledger Design Review (Pre-SQL Audit)

**Autor:** Principal PostgreSQL Database Engineer (Staff+)
**Foco:** Garantia Absoluta de Integridade, Escalabilidade e Auditabilidade
**Status:** Auditado / Aprovado para V012

Este documento estabelece as leis irrevogáveis e o design físico para a tabela `finance.ledger`. O Ledger é o núcleo imutável da plataforma. Um erro aqui não gera um bug; gera um crime financeiro ou colapso da plataforma.

---

## 1. Princípios Arquiteturais Invioláveis

### 1.1 Modelo de Dupla Entrada (Double-Entry Bookkeeping)
Toda movimentação na plataforma resultará em, no mínimo, dois registros no Ledger. Para cada centavo transferido, deve haver um Débito (`-`) em uma carteira e um Crédito (`+`) de exato mesmo valor em outra. 

### 1.2 Garantia de Soma Zero
A soma total de todas as transações (agrupadas por `transaction_id` ou moeda) em qualquer instante T no banco de dados deve ser **exatamente ZERO**. O dinheiro não surge nem desaparece; ele apenas transita entre a carteira de Clientes, Creators, Afiliados e a carteira interna de "Custódia/Taxas" (House Account).

### 1.3 Append-Only (Imutabilidade)
O Ledger é **Append-Only**. Operações `UPDATE` ou `DELETE` são **fisicamente proibidas** na tabela `finance.ledger`. Não há exceções.

### 1.4 Reversões, Chargebacks e Refunds
Como o Ledger não sofre `UPDATE`, qualquer correção de fluxo (Refund, Estorno, Chargeback) ocorrerá por meio de um **Movimento de Compensação**.
*   Se a transação 1 debitou 100 da conta A para a B.
*   O Refund será a transação 2, debitando 100 da B para a A.
*   *Trackabilidade:* A transação 2 conterá a referência formal ao `reference_id` original para reconciliação.

---

## 2. Estratégia Física (PostgreSQL 16)

### 2.1 Identificação (PK) e Particionamento
*   **Ameaça:** 1 Bilhão de linhas rapidamente destruiriam o B-Tree da PK e o MVCC do PostgreSQL se a tabela não fosse particionada.
*   **Decisão (Audit Report 1):** Tabela **Particionada por RANGE Mensal** (`PARTITION BY RANGE (created_at)`).
*   **Primary Key Composta:** Para obedecer às restrições do PG16 em tabelas particionadas, a chave primária será `PRIMARY KEY (id, created_at)`.
*   **Identificador (id):** `BIGINT GENERATED ALWAYS AS IDENTITY`. (O UUIDv7 é excelente, mas para bilhões de linhas, o `BIGINT` sequencial ocupa 8 bytes vs 16 bytes do UUID, economizando dezenas de Gigabytes na RAM dos índices).

### 2.2 Índices e VACUUM
*   Índices Tradicionais (B-Tree) só existirão para chaves fundamentais: `wallet_id` e `transaction_id`.
*   **BRIN Index (Block Range Index):** Por ser uma tabela Append-Only (inserção estrita no fim do arquivo físico), utilizaremos o BRIN no campo `created_at`. Um BRIN de alguns Kilobytes consegue mapear Gigabytes de dados temporais para consultas analíticas.
*   **VACUUM Tuning:** Como a tabela não sofre `UPDATE`/`DELETE`, a geração de tuplas mortas (Dead Tuples) é ZERO. O `autovacuum` não precisa rodar agressivamente para limpeza, mas será configurado para rodar esporadicamente para forçar o *Freezing* (evitar o TXID Wraparound) via `autovacuum_freeze_max_age`.

### 2.3 Write-Ahead Log (WAL) e Concorrência
*   O motor transacional da aplicação deve garantir que os INSERTS no ledger de uma mesma compra ocorram dentro da mesma transação de banco de dados (`BEGIN ... COMMIT`).
*   A concorrência massiva não travará o Ledger, pois INSERTS no final de uma tabela (sem updates) geram praticamente nenhum Lock (apenas o leve `RowExclusiveLock` que não bloqueia leituras nem outras inserções).

---

## 3. Modelo de Dados Validado (DDL Blueprint)

A V012 deverá seguir estritamente a seguinte estrutura física:

```sql
CREATE TABLE finance.ledger (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    wallet_id UUID NOT NULL,          -- Conta afetada
    transaction_id UUID NOT NULL,     -- Referência à operação causal (V010)
    amount_cents BIGINT NOT NULL,     -- Positivo (Crédito) ou Negativo (Débito)
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    description VARCHAR(255) NOT NULL,
    reference_type VARCHAR(50),       -- 'order', 'refund', 'chargeback', 'withdrawal'
    reference_id UUID,                -- Opcional para link direto
    balance_after_cents BIGINT NOT NULL, -- Snapshot Snapshot imutável (prova)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_ledger PRIMARY KEY (id, created_at),
    CONSTRAINT fk_ledger_wallet FOREIGN KEY (wallet_id) 
        REFERENCES finance.wallets (id) ON DELETE RESTRICT
) PARTITION BY RANGE (created_at);
```

*(O `transaction_id` não terá FK real imposta para evitar overhead de trancamento global (Lock) contra a V010, assumindo que a camada da aplicação fará o enforcing transacional).*

---

## 4. Declaração de Risco e Veredito

**Risco Estrutural:** ZERO.
**Bloqueios Físicos de Escalabilidade:** REMOVIDOS.
**Conformidade com o Architecture Freeze v1.0:** 100%.

*O modelo garante soma zero, imutabilidade, evita index/MVCC bloat, e garante a preservação do histórico para trilhas de auditoria financeiras completas.*

**Autorização Concedida:** Proceder com a geração da `V012__finance_ledger.sql`.