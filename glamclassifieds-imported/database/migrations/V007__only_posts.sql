-- V007__only_posts.sql
-- Description: Aggregate de Posts do Creator (Conteúdo Exclusivo) - Altamente coeso
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- Tabela: only.posts
CREATE TABLE only.posts (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    creator_id UUID NOT NULL,
    content TEXT,
    price_cents BIGINT NOT NULL DEFAULT 0, -- 0 = Free for subscribers, > 0 = PPV
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT pk_posts PRIMARY KEY (id),
    CONSTRAINT fk_posts_creator FOREIGN KEY (creator_id) 
        REFERENCES only.creators (id) ON DELETE RESTRICT,
    CONSTRAINT chk_posts_status CHECK (status IN ('draft', 'published', 'archived', 'flagged'))
);

CREATE INDEX idx_posts_creator_id ON only.posts (creator_id);
CREATE INDEX idx_posts_status ON only.posts (status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_before_update_posts_timestamp
    BEFORE UPDATE ON only.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();

-- Tabela: only.post_media
CREATE TABLE only.post_media (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    post_id UUID NOT NULL,
    media_url TEXT NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_post_media PRIMARY KEY (id),
    CONSTRAINT fk_post_media_post FOREIGN KEY (post_id) 
        REFERENCES only.posts (id) ON DELETE RESTRICT
);

CREATE INDEX idx_post_media_post_id ON only.post_media (post_id);

-- Tabela: only.post_access (ACL for PPV / Unlocked Content)
-- Controle de acesso a posts pagos.
CREATE TABLE only.post_access (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    post_id UUID NOT NULL,
    member_id UUID NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_id UUID, -- Referência fraca para evitar cyclic/heavy dependências na inicialização
    
    CONSTRAINT pk_post_access PRIMARY KEY (id),
    CONSTRAINT fk_post_access_post FOREIGN KEY (post_id) 
        REFERENCES only.posts (id) ON DELETE RESTRICT,
    CONSTRAINT fk_post_access_member FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT
);

CREATE INDEX idx_post_access_member_id ON only.post_access (member_id);
CREATE UNIQUE INDEX uidx_post_access_unique ON only.post_access (post_id, member_id);
