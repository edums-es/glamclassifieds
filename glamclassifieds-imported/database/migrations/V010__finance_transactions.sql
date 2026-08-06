-- V010__finance_transactions.sql
-- Description: Aggregate de Transações Financeiras (Gateway)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- ==============================================================================
-- SCHEMA: finance
-- ==============================================================================

-- Tabela: finance.transactions
CREATE TABLE finance.transactions (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    order_id UUID NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'credit_card', 'pix', 'wallet'
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    gateway_id VARCHAR(50) NOT NULL, -- 'stripe', 'asaas', 'internal'
    gateway_transaction_id VARCHAR(150),
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_transactions PRIMARY KEY (id),
    CONSTRAINT fk_transactions_order FOREIGN KEY (order_id) 
        REFERENCES commerce.orders (id) ON DELETE RESTRICT,
    CONSTRAINT chk_transactions_amount CHECK (amount_cents >= 0),
    CONSTRAINT chk_transactions_status CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded'))
);

CREATE INDEX idx_transactions_order_id ON finance.transactions (order_id);
CREATE INDEX idx_transactions_status ON finance.transactions (status);
CREATE UNIQUE INDEX uidx_transactions_gateway_tx ON finance.transactions (gateway_id, gateway_transaction_id) 
    WHERE gateway_transaction_id IS NOT NULL;

CREATE TRIGGER trg_before_update_transactions_timestamp
    BEFORE UPDATE ON finance.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();
