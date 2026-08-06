-- V002__system_and_tracking_foundation.sql
-- Description: Fundação do Sistema (Jobs, Settings) e Data Lake Transacional (Tracking e Outbox)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- ============================================================================
-- SCHEMA: system
-- ============================================================================

-- 1. system.settings
CREATE TABLE IF NOT EXISTS system.settings (
    id TEXT NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_settings PRIMARY KEY (id)
);

CREATE TRIGGER trg_before_update_settings_timestamp
    BEFORE UPDATE ON system.settings
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();

-- 2. system.feature_flags
CREATE TABLE IF NOT EXISTS system.feature_flags (
    id TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_feature_flags PRIMARY KEY (id)
);

CREATE TRIGGER trg_before_update_feature_flags_timestamp
    BEFORE UPDATE ON system.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();

-- 3. system.jobs
CREATE TABLE IF NOT EXISTS system.jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    queue VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    attempts SMALLINT NOT NULL DEFAULT 0,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_jobs PRIMARY KEY (id),
    CONSTRAINT ck_jobs_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue_status_run_at 
    ON system.jobs (queue, status, run_at) 
    WHERE status IN ('pending', 'failed'); -- Partial index para fila

CREATE TRIGGER trg_before_update_jobs_timestamp
    BEFORE UPDATE ON system.jobs
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();

-- 4. system.outbox_events (Particionada por RANGE Diário)
-- O Storage Engine recebe instruções anti-bloat via FILLFACTOR e AUTOVACUUM
CREATE TABLE IF NOT EXISTS system.outbox_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    
    CONSTRAINT pk_outbox_events PRIMARY KEY (id, created_at) -- PK Composta devido ao Particionamento
) PARTITION BY RANGE (created_at)
WITH (
    fillfactor = 90,
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_analyze_scale_factor = 0.01
);

-- Partições Iniciais do Outbox (D0 a D+2)
CREATE TABLE IF NOT EXISTS system.outbox_events_default PARTITION OF system.outbox_events DEFAULT;

CREATE INDEX IF NOT EXISTS idx_outbox_events_unprocessed_partial 
    ON system.outbox_events (created_at) 
    WHERE processed_at IS NULL; -- Partial Index para os Workers

-- ============================================================================
-- SCHEMA: tracking
-- ============================================================================

-- 5. tracking.visitors
CREATE TABLE IF NOT EXISTS tracking.visitors (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    fingerprint TEXT,
    origin_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_visitors PRIMARY KEY (id)
);

CREATE TRIGGER trg_before_update_visitors_timestamp
    BEFORE UPDATE ON tracking.visitors
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();

-- 6. tracking.events_raw (Particionada por RANGE Mensal)
-- Ausência de FK proposital conforme Design Review (Escala de Bilhões)
CREATE TABLE IF NOT EXISTS tracking.events_raw (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    event_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_events_raw PRIMARY KEY (id, created_at) -- PK Composta devido ao particionamento
) PARTITION BY RANGE (created_at);

-- Partição Inicial do Events Raw
CREATE TABLE IF NOT EXISTS tracking.events_raw_default PARTITION OF tracking.events_raw DEFAULT;

-- Índice BRIN para varredura analítica massiva por tempo sem estourar o disco
CREATE INDEX IF NOT EXISTS idx_events_raw_created_at_brin 
    ON tracking.events_raw USING BRIN (created_at);
