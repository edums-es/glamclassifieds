-- V006__classifieds_listings.sql
-- Description: Aggregate de Anúncios (Classificados) - Altamente coeso
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- Tabela: classifieds.listings (Ads)
CREATE TABLE classifieds.listings (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    member_id UUID NOT NULL,
    category_id UUID NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    region_state VARCHAR(2) NOT NULL,
    region_city VARCHAR(150) NOT NULL,
    price_cents BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT pk_listings PRIMARY KEY (id),
    CONSTRAINT fk_listings_member FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT,
    CONSTRAINT fk_listings_category FOREIGN KEY (category_id) 
        REFERENCES classifieds.categories (id) ON DELETE RESTRICT,
    CONSTRAINT chk_listings_status CHECK (status IN ('draft', 'published', 'paused', 'rejected', 'expired'))
);

CREATE INDEX idx_listings_member_id ON classifieds.listings (member_id);
CREATE INDEX idx_listings_category_id ON classifieds.listings (category_id);
CREATE INDEX idx_listings_region ON classifieds.listings (region_state, region_city) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_listings_status ON classifieds.listings (status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_before_update_listings_timestamp
    BEFORE UPDATE ON classifieds.listings
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();

-- Tabela: classifieds.listing_media
-- Note: Cascading delete is explicitly forbidden by Architecture Freeze. Use RESTRICT.
CREATE TABLE classifieds.listing_media (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    listing_id UUID NOT NULL,
    media_url TEXT NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_listing_media PRIMARY KEY (id),
    CONSTRAINT fk_listing_media_listing FOREIGN KEY (listing_id) 
        REFERENCES classifieds.listings (id) ON DELETE RESTRICT
);

CREATE INDEX idx_listing_media_listing_id ON classifieds.listing_media (listing_id);
-- Partial index to ensure only one primary media per listing
CREATE UNIQUE INDEX uidx_listing_media_primary ON classifieds.listing_media (listing_id) WHERE is_primary = TRUE;
