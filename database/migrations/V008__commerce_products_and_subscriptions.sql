-- V008__commerce_products_and_subscriptions.sql
-- Description: Aggregate de Produtos, Catálogo e Assinaturas
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- ==============================================================================
-- SCHEMA: commerce
-- ==============================================================================

-- Tabela: commerce.products
CREATE TABLE commerce.products (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    creator_id UUID, -- NULL se for produto da plataforma (ex: Taxa de Destaque)
    name VARCHAR(150) NOT NULL,
    description TEXT,
    product_type VARCHAR(50) NOT NULL, -- 'subscription', 'ppv', 'boost'
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT pk_products PRIMARY KEY (id),
    CONSTRAINT fk_products_creator FOREIGN KEY (creator_id) 
        REFERENCES only.creators (id) ON DELETE RESTRICT,
    CONSTRAINT chk_products_status CHECK (status IN ('active', 'draft', 'archived'))
);

CREATE INDEX idx_products_creator_id ON commerce.products (creator_id);
CREATE INDEX idx_products_type ON commerce.products (product_type) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_before_update_products_timestamp
    BEFORE UPDATE ON commerce.products
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();

-- Tabela: commerce.prices
CREATE TABLE commerce.prices (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    product_id UUID NOT NULL,
    price_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    billing_period VARCHAR(20), -- 'monthly', 'yearly', NULL para one-time
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_prices PRIMARY KEY (id),
    CONSTRAINT fk_prices_product FOREIGN KEY (product_id) 
        REFERENCES commerce.products (id) ON DELETE RESTRICT,
    CONSTRAINT chk_prices_cents CHECK (price_cents >= 0)
);

CREATE INDEX idx_prices_product_id ON commerce.prices (product_id);

CREATE TRIGGER trg_before_update_prices_timestamp
    BEFORE UPDATE ON commerce.prices
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();

-- Tabela: commerce.offers (Dynamic pricing/Discounts/Upsells)
CREATE TABLE commerce.offers (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    product_id UUID NOT NULL,
    base_price_id UUID NOT NULL,
    discount_cents BIGINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_offers PRIMARY KEY (id),
    CONSTRAINT fk_offers_product FOREIGN KEY (product_id) 
        REFERENCES commerce.products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_offers_price FOREIGN KEY (base_price_id) 
        REFERENCES commerce.prices (id) ON DELETE RESTRICT
);

CREATE INDEX idx_offers_product_id ON commerce.offers (product_id);

CREATE TRIGGER trg_before_update_offers_timestamp
    BEFORE UPDATE ON commerce.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();

-- Tabela: commerce.subscriptions
CREATE TABLE commerce.subscriptions (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    member_id UUID NOT NULL,
    product_id UUID NOT NULL,
    price_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'incomplete',
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_subscriptions PRIMARY KEY (id),
    CONSTRAINT fk_subs_member FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT,
    CONSTRAINT fk_subs_product FOREIGN KEY (product_id) 
        REFERENCES commerce.products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_subs_price FOREIGN KEY (price_id) 
        REFERENCES commerce.prices (id) ON DELETE RESTRICT,
    CONSTRAINT chk_subs_status CHECK (status IN ('incomplete', 'active', 'past_due', 'canceled', 'unpaid'))
);

CREATE INDEX idx_subscriptions_member_id ON commerce.subscriptions (member_id);
CREATE INDEX idx_subscriptions_status ON commerce.subscriptions (status);

CREATE TRIGGER trg_before_update_subscriptions_timestamp
    BEFORE UPDATE ON commerce.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();