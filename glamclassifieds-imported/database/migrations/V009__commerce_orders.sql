-- V009__commerce_orders.sql
-- Description: Aggregate de Pedidos (Orders)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- Tabela: commerce.orders
CREATE TABLE commerce.orders (
    id UUID NOT NULL DEFAULT public.fn_generate_uuid_v7(),
    member_id UUID NOT NULL,
    total_amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    gateway_reference VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_orders PRIMARY KEY (id),
    CONSTRAINT fk_orders_member FOREIGN KEY (member_id) 
        REFERENCES core.members (id) ON DELETE RESTRICT,
    CONSTRAINT chk_orders_amount CHECK (total_amount_cents >= 0),
    CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'canceled'))
);

CREATE INDEX idx_orders_member_id ON commerce.orders (member_id);
CREATE INDEX idx_orders_status ON commerce.orders (status);
CREATE UNIQUE INDEX uidx_orders_gateway_ref ON commerce.orders (gateway_reference) WHERE gateway_reference IS NOT NULL;

CREATE TRIGGER trg_before_update_orders_timestamp
    BEFORE UPDATE ON commerce.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_update_timestamp();

-- Tabela: commerce.order_items
-- Note: Itens pertencem intimamente ao Pedido. ID serial/bigint é aceitável por ser entidade interna (child), 
-- mas seguiremos a documentação usando BIGINT GENERATED ALWAYS AS IDENTITY
CREATE TABLE commerce.order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    offer_id UUID, -- NULL se preço base
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents BIGINT NOT NULL,
    total_price_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_order_items PRIMARY KEY (id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) 
        REFERENCES commerce.orders (id) ON DELETE RESTRICT,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) 
        REFERENCES commerce.products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_order_items_offer FOREIGN KEY (offer_id) 
        REFERENCES commerce.offers (id) ON DELETE RESTRICT,
    CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
    CONSTRAINT chk_order_items_prices CHECK (unit_price_cents >= 0 AND total_price_cents >= 0)
);

CREATE INDEX idx_order_items_order_id ON commerce.order_items (order_id);
CREATE INDEX idx_order_items_product_id ON commerce.order_items (product_id);
