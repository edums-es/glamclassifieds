-- V008_1__fix_subscriptions_unique_active.sql
-- Description: Correção Aditiva da V008 (Prevenção de Double Billing via Partial Unique Index)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- 1. Prevenção Absoluta de Assinatura Dupla (Double Billing)
-- Impede que um membro possua múltiplas assinaturas concorrentes para o mesmo produto.
-- Assinaturas 'canceled' ou 'unpaid' (mortas) são ignoradas pela constraint,
-- permitindo recadastros no futuro.
CREATE UNIQUE INDEX uidx_subscriptions_active_unique 
    ON commerce.subscriptions (member_id, product_id) 
    WHERE status IN ('active', 'past_due', 'incomplete');
