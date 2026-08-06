-- V004__core_crm_and_identities.sql
-- Description: Core CRM (Members, Devices) and Tracking Identities (Cross-Device)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+
-- Layer: 2 (Core e CRM)

-- ============================================================================
-- SCHEMA: core
-- ============================================================================

-- 1. core.members
CREATE TABLE IF NOT EXISTS core.members (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    auth_user_id UUID NOT NULL,
    acquisition_affiliate_id UUID,
    current_manager_id UUID,
    full_name VARCHAR(255) NOT NULL,
    document_cpf VARCHAR(11),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT pk_members PRIMARY KEY (id),
    
    CONSTRAINT fk_members_auth_user_id_users FOREIGN KEY (auth_user_id) 
        REFERENCES auth.users (id) ON DELETE RESTRICT NOT DEFERRABLE,
        
    CONSTRAINT fk_members_acq_affiliate_id_members FOREIGN KEY (acquisition_affiliate_id) 
        REFERENCES core.members (id) ON DELETE SET NULL NOT DEFERRABLE,
        
    CONSTRAINT fk_members_curr_manager_id_members FOREIGN KEY (current_manager_id) 
        REFERENCES core.members (id) ON DELETE SET NULL NOT DEFERRABLE
);

-- Índices obrigatórios para as FKs de relacionamento interno
CREATE INDEX IF NOT EXISTS idx_members_acq_affiliate_id 
    ON core.members (acquisition_affiliate_id);
    
CREATE INDEX IF NOT EXISTS idx_members_curr_manager_id 
    ON core.members (current_manager_id);

-- Índices Únicos Parciais (Compatibilidade rigorosa com Soft Delete GDPR)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_members_document_cpf 
    ON core.members (document_cpf) 
    WHERE deleted_at IS NULL AND document_cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_members_auth_user_id 
    ON core.members (auth_user_id) 
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_before_update_members_timestamp
    BEFORE UPDATE ON core.members
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();


-- 2. core.devices
-- Dispositivos para Anti-Fraude
CREATE TABLE IF NOT EXISTS core.devices (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    member_id UUID NOT NULL,
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_devices PRIMARY KEY (id),
    CONSTRAINT fk_devices_member_id_members FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT NOT DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_devices_member_id 
    ON core.devices (member_id);

CREATE TRIGGER trg_before_update_devices_timestamp
    BEFORE UPDATE ON core.devices
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();

-- ============================================================================
-- SCHEMA: tracking
-- ============================================================================

-- 3. tracking.identities_merge
-- Resolve o Cross-Device (Liga visitante anônimo ao membro logado)
CREATE TABLE IF NOT EXISTS tracking.identities_merge (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    visitor_id UUID NOT NULL,
    member_id UUID NOT NULL,
    merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_identities_merge PRIMARY KEY (id),
    CONSTRAINT uk_identities_merge_visitor UNIQUE (visitor_id), -- Um visitante anônimo só pode ser fundido uma vez
    
    CONSTRAINT fk_identities_merge_visitor_id_visitors FOREIGN KEY (visitor_id) 
        REFERENCES tracking.visitors (id) ON DELETE RESTRICT NOT DEFERRABLE,
        
    CONSTRAINT fk_identities_merge_member_id_members FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT NOT DEFERRABLE
);

-- visitor_id já é coberto pela constraint UNIQUE. Criamos índice para member_id.
CREATE INDEX IF NOT EXISTS idx_identities_merge_member_id 
    ON tracking.identities_merge (member_id);


-- 4. tracking.sessions
-- Origem de tráfego (UTMs)
CREATE TABLE IF NOT EXISTS tracking.sessions (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    visitor_id UUID NOT NULL,
    affiliate_id UUID,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_tracking_sessions PRIMARY KEY (id),
    CONSTRAINT fk_tracking_sessions_visitor_id_visitors FOREIGN KEY (visitor_id) 
        REFERENCES tracking.visitors (id) ON DELETE RESTRICT NOT DEFERRABLE,
        
    CONSTRAINT fk_tracking_sessions_affiliate_id_members FOREIGN KEY (affiliate_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT NOT DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_visitor_id 
    ON tracking.sessions (visitor_id);
    
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_affiliate_id 
    ON tracking.sessions (affiliate_id);
