# Sprint 8: PostgreSQL Integration for CreatorsRepository

## Objetivos Alcançados
- **Migração do Repository**: O `CreatorsRepository` (que antes usava Map/em-memória) foi reescrito para utilizar **Kysely** gerando queries SQL type-safe contra um banco **PostgreSQL**.
- **Definição de Schema e Conexão**: Criado o `DatabaseModule` fornecendo o client Kysely injetável, e mapeado o schema da tabela `only_creator_profiles` no arquivo `src/shared/database/schema.ts`.
- **Manutenção de Contrato**: Os Controllers, Services e DTOs permaneceram intocados. A interface de retorno do repositório (`ICreator`) continua idêntica.
- **Teste de Integração (Testcontainers)**: Desenvolvido `creators.repository.integration.spec.ts` utilizando `@testcontainers/postgresql`. O teste sobe um container efêmero, aplica o schema SQL (`CREATE TABLE`), e testa as rotinas de insert, duplicidade (restrição no banco `UNIQUE`), buscas case-insensitive pelo username e updates.

## Arquivos Modificados/Criados
1. `src/modules/creators/repositories/creators.repository.ts` (Atualizado para PostgreSQL)
2. `src/shared/database/schema.ts` (Criado)
3. `src/shared/database/database.module.ts` (Criado)
4. `src/modules/creators/__tests__/creators.repository.integration.spec.ts` (Criado Testcontainers)

## Próximos Passos (Próximos Sprints)
- Substituir repositórios de Posts e Commerce gradativamente.
- Adicionar mecanismos de migrations robustos no Kysely (em vez de usar `sql` bruto no Testcontainers).
- Ajustar os testes E2E para usarem um banco de dados real em vez do mock.