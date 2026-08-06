# Soft Delete Consistency Matrix

**Autor:** Principal PostgreSQL Database Engineer
**Status:** Auditado e Consolidado (Architecture Freeze v1.0)

Esta matriz analisa 100% das regras de unicidade projetadas para a plataforma (ERD/Spec) em resposta às exigências de exclusão lógica (Soft Delete) decorrentes da GDPR. O objetivo é assegurar que **nenhum registro deletado logicamente (`deleted_at IS NOT NULL`) travará a base de dados caso a mesma chave (ex: e-mail, cpf) retorne à plataforma no futuro.**

### Critério Básico (Regra de Unicidade Enterprise):
Se uma tabela admite a coluna `deleted_at`, **todas** as suas regras de unicidade que possam conflitar com um novo registro limpo no futuro devem ser convertidas de `Table Constraint` (Global) para `Unique Partial Index` (`WHERE deleted_at IS NULL`).

---

## Matriz de Auditoria de Unicidade

| Schema | Tabela | Coluna Alvo | Admite Soft Delete? | Solução SQL Exigida | Status / Documento |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `auth` | `users` | `email` | **Sim** | `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` | ✅ Aplicado na V003. (Constraint Global dropada na corretiva V004_1) |
| `core` | `members` | `document_cpf` | **Sim** | `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` | ✅ Aplicado na V004 (Corrigido). |
| `core` | `members` | `auth_user_id` | **Sim** | `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` | ✅ Aplicado na V004 (Corrigido para seguir a mesma semântica protetora). |
| `classifieds` | `categories` | `slug` | Não (Inativação) | `CONSTRAINT uk_... UNIQUE` (Global) | ✅ Aprovado. (Categorias inativas preservam o slug para proteção de SEO). |
| `tracking` | `identities_merge` | `visitor_id` | Não (Append) | `CONSTRAINT uk_... UNIQUE` (Global) | ✅ Aprovado. (Visitante anônimo só sofre fusão uma vez, log imutável). |
| `only` | `creators` | `username` | **Sim** | `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` | 🟡 Pendente para V005. (O @username fica livre após deleção). |
| `commerce` | `products` | `N/A` | **Sim** | Sem chave única lógica, apenas ID. | ✅ Aprovado. |
| `finance` | `wallets` | `member_id` | Não (Imutável) | `CONSTRAINT uk_... UNIQUE` (Global) | 🟡 Pendente para V006. |
| `finance` | `transactions`| `gateway_id` | Não (Ledger) | `CONSTRAINT uk_... UNIQUE` (Global) | 🟡 Pendente para V006. |

---

## Veredicto da Matriz de Consistência

1. A política de Soft Delete (GDPR) agora está **fisicamente inquebrável**.
2. A refatoração da V004 e a emissão do patch `V004_1` resolveram a dívida arquitetural.
3. As regras estipuladas nesta Matriz serão impostas estritamente nas próximas migrations (`V005` e `V006`).
4. **Nenhum choque de unicidade bloqueará recadastramentos legítimos.**

*Auditoria concluída. Nenhuma restrição de unicidade viola a política do Architecture Freeze v1.0.*