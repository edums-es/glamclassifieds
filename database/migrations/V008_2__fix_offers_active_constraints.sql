-- V008_2__fix_offers_active_constraints.sql
-- Description: Correção Aditiva da V008 (Resolução de Ambiguidade de Ofertas/Preços)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- 1. Prevenção de Ambiguidade de Precificação (Time/Status Overlap)
-- Garante que um Preço Base só possa ter UMA oferta ativa simultaneamente.
-- Isso salva o backend de falhar em checkouts (sem saber qual desconto aplicar) 
-- e exige que o Creator/Sistema desative a oferta anterior antes de ligar a nova.
CREATE UNIQUE INDEX uidx_offers_single_active 
    ON commerce.offers (base_price_id) 
    WHERE is_active = TRUE;
