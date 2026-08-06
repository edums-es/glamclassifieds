-- V011__finance_wallets.sql
-- Description: Aggregate de Carteiras Digitais (Hot-Spot Transacional)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- Tabela: finance.wallets
-- NOTA ARQUITETURAL (Audit Item 3): Sem trigger de updated_at automático.
-- O FILLFACTOR 85 requer que updates ocorram sem tocar em colunas indexadas se possível (HOT updates).
-- O campo updated_at DEVE ser atualizado via código na query de UPDATE explícita.
CREATE TABLE finance.wallets (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    member_id UUID NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    balance_cents BIGINT NOT NULL DEFAULT 0,
    blocked_cents BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_wallets PRIMARY KEY (id),
    CONSTRAINT fk_wallets_member FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT,
    CONSTRAINT chk_wallets_status CHECK (status IN ('active', 'suspended', 'closed'))
) WITH (fillfactor = 85);

-- Cada membro tem apenas 1 carteira ativa por moeda (1:1 per currency)
CREATE UNIQUE INDEX uidx_wallets_member_currency ON finance.wallets (member_id, currency);

-- ==============================================================================
-- Regras Físicas Otimizadas:
-- 1. Sem trigger BEFORE UPDATE de timestamp
-- 2. fillfactor = 85 (Permite HOT updates para saldo, reduzindo write amplification e bloqueios pesados)
-- ==============================================================================
