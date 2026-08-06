-- V004_1__fix_auth_users_soft_delete_constraint.sql
-- Description: Correção Aditiva da V003 para aderência estrita à Política GDPR (Soft Delete)
-- Author: Senior PostgreSQL Database Engineer
-- Target: PostgreSQL 16+

-- 1. Remoção da Constraint Clássica Global
-- A constraint uk_users_email bloqueava a criação de novas contas se o e-mail pertencesse a um usuário
-- "soft deleted". Esta constraint fere a política de exclusão lógica e recadastro.
ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS uk_users_email;

-- Nota: O Índice uidx_users_lower_email criado na V003 já possui a cláusula
-- WHERE deleted_at IS NULL, sendo agora o único e soberano guardião da unicidade.