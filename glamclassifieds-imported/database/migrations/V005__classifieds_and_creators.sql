-- V005__classifieds_and_creators.sql
-- Description: Inicialização do módulo de Classificados e Creators (Conteúdo Adulto)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- ==============================================================================
-- SCHEMA: classifieds
-- ==============================================================================

-- Tabela: classifieds.categories
-- Note: Categories uses standard UNIQUE constraint because it does not have deleted_at
CREATE TABLE classifieds.categories (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    parent_id UUID NULL,
    slug VARCHAR(150) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    icon_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_categories PRIMARY KEY (id),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) 
        REFERENCES classifieds.categories (id) ON DELETE RESTRICT,
    CONSTRAINT uk_categories_slug UNIQUE (slug)
);

CREATE INDEX idx_categories_parent_id ON classifieds.categories (parent_id);

CREATE TRIGGER trg_before_update_categories_timestamp
    BEFORE UPDATE ON classifieds.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();

-- ==============================================================================
-- SCHEMA: only (Creators / Conteúdo Fechado)
-- ==============================================================================

-- Tabela: only.creators
CREATE TABLE only.creators (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    member_id UUID NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    bio TEXT,
    cover_url TEXT,
    avatar_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_date TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT pk_creators PRIMARY KEY (id),
    CONSTRAINT fk_creators_member FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT,
    CONSTRAINT chk_creators_status CHECK (status IN ('active', 'suspended', 'banned'))
);

CREATE INDEX idx_creators_member_id ON only.creators (member_id);

-- Soft Delete GDPR Uniqueness rules applied via partial index
CREATE UNIQUE INDEX uidx_creators_username ON only.creators (username) WHERE deleted_at IS NULL;
-- Enforce a single active creator profile per member
CREATE UNIQUE INDEX uidx_creators_member_id ON only.creators (member_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_before_update_creators_timestamp
    BEFORE UPDATE ON only.creators
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();
