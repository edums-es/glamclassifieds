-- V003__identity_and_auth.sql
-- Description: Identidade de Segurança (Auth) e Categorias do Legado
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+
-- Layer: 1 (Identidade e Infraestrutura Base)

-- ============================================================================
-- SCHEMA: auth
-- ============================================================================

-- 1. auth.users
-- Domínio estrito de segurança e login
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft-delete exigido por regras de negócio/GDPR
    
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);

-- Expression Index para buscas case-insensitive e proteção do Auth Layer
CREATE UNIQUE INDEX IF NOT EXISTS uidx_users_lower_email 
    ON auth.users (lower(email)) 
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_before_update_users_timestamp
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();

-- 2. auth.sessions
-- Controle de JWT/Refresh Tokens
CREATE TABLE IF NOT EXISTS auth.sessions (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    user_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_sessions PRIMARY KEY (id),
    -- Cascata estrita: Sessões não possuem utilidade sem o usuário pai.
    CONSTRAINT fk_sessions_user_id_users FOREIGN KEY (user_id) 
        REFERENCES auth.users (id) ON DELETE CASCADE NOT DEFERRABLE
);

-- Índice obrigatório para a FK e para limpeza de sessões expiradas
CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
    ON auth.sessions (user_id);
    
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at 
    ON auth.sessions (expires_at);

-- ============================================================================
-- SCHEMA: classifieds
-- ============================================================================

-- 3. classifieds.categories
-- Árvore de hierarquia para o módulo legado
CREATE TABLE IF NOT EXISTS classifieds.categories (
    id UUID NOT NULL DEFAULT system.fn_generate_uuid_v7(),
    parent_id UUID,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT pk_categories PRIMARY KEY (id),
    CONSTRAINT uk_categories_slug UNIQUE (slug),
    -- RESTRICT: Impedir apagar categoria pai que ainda tem filhos (Impede orfandade).
    CONSTRAINT fk_categories_parent_id_categories FOREIGN KEY (parent_id) 
        REFERENCES classifieds.categories (id) ON DELETE RESTRICT NOT DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id 
    ON classifieds.categories (parent_id);

CREATE TRIGGER trg_before_update_categories_timestamp
    BEFORE UPDATE ON classifieds.categories
    FOR EACH ROW
    EXECUTE FUNCTION system.fn_update_timestamp();
