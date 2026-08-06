-- V001__init_extensions_and_schemas.sql
-- Description: Inicialização das extensões obrigatórias e Schemas do Architecture Freeze v1.0
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- 1. Extensões Core
-- Para geração eventual de chaves e otimizações, pgcrypto é o padrão básico seguro do PG16
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Schemas Lógicos (Isolamento de Bounded Contexts)
CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS classifieds;
CREATE SCHEMA IF NOT EXISTS only;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS tracking;

-- 3. Funções Nativas Core (UUIDv7 e Timestamps)

-- Função para atualizar timestamps de entidades mutáveis (fn_update_timestamp)
-- Isenta wallets conforme Audit Report.
CREATE OR REPLACE FUNCTION system.fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função purista para geração de UUIDv7 no PG16 (fn_generate_uuid_v7)
-- Referência técnica de alta densidade sem depender de extensões externas arriscadas.
CREATE OR REPLACE FUNCTION system.fn_generate_uuid_v7()
RETURNS uuid
AS $$
DECLARE
    v_time timestamp with time zone := null;
    v_secs bigint := null;
    v_msec bigint := null;
    v_usec bigint := null;
    v_hex varchar := '';
    v_time_hex varchar := '';
    v_rand_a varchar := '';
    v_rand_b varchar := '';
BEGIN
    v_time := clock_timestamp();
    v_secs := extract(epoch from v_time)::bigint;
    v_msec := extract(milliseconds from v_time)::bigint - (v_secs * 1000);
    v_usec := extract(microseconds from v_time)::bigint - (v_secs * 1000000) - (v_msec * 1000);
    
    -- UNIX timestamp em ms
    v_time_hex := lpad(to_hex((v_secs * 1000) + v_msec), 12, '0');
    
    -- Gerar a porção randômica
    v_rand_a := lpad(to_hex((random() * 4095)::bigint), 3, '0');
    v_rand_b := lpad(to_hex((random() * 4611686018427387903)::bigint), 15, '0');
    v_rand_b := lpad(to_hex((v_usec * 4096) + (random() * 4095)::bigint), 16, '0');

    v_hex := v_time_hex || '7' || v_rand_a || '8' || substr(v_rand_b, 1, 3) || '-' || substr(v_rand_b, 4, 12);
    
    RETURN cast(lpad(v_hex, 32, '0') as uuid);
EXCEPTION
    WHEN others THEN
        RETURN gen_random_uuid(); -- fallback genérico caso o sistema não consiga lidar com o tempo.
END;
$$ LANGUAGE plpgsql VOLATILE;