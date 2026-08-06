-- V012__finance_ledger.sql
-- Description: Aggregate do Ledger Financeiro (Dupla-Entrada, Particionado, Imutável)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+
-- ADR: ADR 001 - Soft References aplicadas no transaction_id

-- ==============================================================================
-- SCHEMA: finance
-- TABELA: finance.ledger (Tabela Pai / Particionada)
-- ==============================================================================

CREATE TABLE finance.ledger (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    wallet_id UUID NOT NULL,
    transaction_id UUID NOT NULL, -- SOFT REFERENCE (ADR 001). NO FOREIGN KEY.
    amount_cents BIGINT NOT NULL, -- Pode ser Positivo (Credit) ou Negativo (Debit)
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    description VARCHAR(255) NOT NULL,
    reference_type VARCHAR(50),   -- Ex: 'order', 'refund', 'chargeback', 'withdrawal', 'fee'
    reference_id UUID,            -- Ref adicional genérica
    balance_after_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- PK Composta exigida pelo PG16 para particionamento temporal
    CONSTRAINT pk_ledger PRIMARY KEY (id, created_at),
    CONSTRAINT fk_ledger_wallet FOREIGN KEY (wallet_id) 
        REFERENCES finance.wallets (id) ON DELETE RESTRICT
) PARTITION BY RANGE (created_at);

-- Índices B-Tree convencionais para pesquisas precisas
CREATE INDEX idx_ledger_wallet_id ON finance.ledger (wallet_id);
CREATE INDEX idx_ledger_transaction_id ON finance.ledger (transaction_id);

-- Índice BRIN para varredura analítica de longo alcance baseada em tempo (Append-Only)
CREATE INDEX idx_ledger_created_at_brin ON finance.ledger USING BRIN (created_at);

-- ==============================================================================
-- PROTEÇÃO DE IMUTABILIDADE (APPEND-ONLY)
-- ==============================================================================

CREATE OR REPLACE FUNCTION finance.fn_prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRITICAL: The finance.ledger table is APPEND-ONLY. UPDATE or DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_ledger_update
    BEFORE UPDATE ON finance.ledger
    FOR EACH ROW EXECUTE FUNCTION finance.fn_prevent_ledger_mutation();

CREATE TRIGGER trg_prevent_ledger_delete
    BEFORE DELETE ON finance.ledger
    FOR EACH ROW EXECUTE FUNCTION finance.fn_prevent_ledger_mutation();

-- ==============================================================================
-- CRIAÇÃO DAS PARTIÇÕES INICIAIS (Primeiro Ano de Operação - 2026/2027)
-- ==============================================================================

-- Agosto 2026
CREATE TABLE finance.ledger_2026_08 PARTITION OF finance.ledger 
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

-- Setembro 2026
CREATE TABLE finance.ledger_2026_09 PARTITION OF finance.ledger 
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

-- Outubro 2026
CREATE TABLE finance.ledger_2026_10 PARTITION OF finance.ledger 
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

-- Novembro 2026
CREATE TABLE finance.ledger_2026_11 PARTITION OF finance.ledger 
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

-- Dezembro 2026
CREATE TABLE finance.ledger_2026_12 PARTITION OF finance.ledger 
    FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

-- Janeiro 2027
CREATE TABLE finance.ledger_2027_01 PARTITION OF finance.ledger 
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');
