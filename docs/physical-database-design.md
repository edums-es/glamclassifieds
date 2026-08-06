# Enterprise Physical Database Design (PostgreSQL 16+)

**Autor:** Principal PostgreSQL Database Engineer (Staff+)
**Foco:** Tradução da Arquitetura Lógica (Revenue OS v1.0) para Banco de Dados Físico Enterprise (Billion-Row Scale)
**Status:** Architecture Freeze v1.0 Implementação Física

Este documento não define código (SQL), mas sim as fundações, leis e restrições físicas de operação da infraestrutura PostgreSQL que suportarão operações de altíssimo volume transacional e de dados.

---

## 1. Organização Física (Logical-Physical Separation)

### PostgreSQL Schemas
Isolamento lógico-estrutural (Schemas nativos e não bancos separados, suportando o Modular Monolith com junções ultra-rápidas locais quando estritamente necessário).
*   `auth`, `core`, `only`, `commerce`, `finance`, `tracking`, `system`.

### Search Path
*   **Convenção de Código:** As aplicações (ORMs/Query Builders) NÃO dependerão de Search Path implícito mutável. Toda chamada será totalmente qualificada (`schema_name.table_name`).
*   **Motivo:** Evita colisão de nomes, falhas de segurança por injeção de schemas intermediários (CVE-2018-1058), e permite o cache transparente dos query plans do Postgres de maneira universal.

### Convenção de Nomes
A rigidez no naming salva tempo no debugging noturno:
*   **Tabelas:** `schema_name.plural_noun` (`finance.wallets`, `core.members`).
*   **Colunas:** `snake_case`.
*   **Constraints de Chave Primária:** `pk_{tabela}` (`pk_wallets`).
*   **Constraints Estrangeiras:** `fk_{tabela}_{coluna}_{tabela_ref}` (`fk_wallets_member_id_members`).
*   **Constraints Únicas e Check:** `uk_{tabela}_{coluna}` e `ck_{tabela}_{regra}`.
*   **Índices:** `idx_{tabela}_{coluna1_coluna2}`. Sufixo `_partial` para parciais e `_gin` para text/arrays.
*   **Triggers:** `trg_{tabela}_{timing}_{action}` (`trg_wallets_before_update`).

---

## 2. Estratégia de Primary Keys

### UUIDv7
*   **Onde usar:** Entidades de Domínio / Negócio (Ex: `core.members`, `commerce.orders`, `only.creators`).
*   **Justificativa:** O UUIDv7 é ordenável cronologicamente (time-sorted). Ao contrário do UUIDv4 clássico, ele **não causa severa fragmentação (Page Splits)** nas árvores B-Tree do PostgreSQL quando o sistema realiza inserções massivas. Preserva I/O e a saúde do banco.

### BIGINT (GENERATED ALWAYS AS IDENTITY)
*   **Onde usar:** Dados massivos, apêndices transacionais, e eventos (Ex: `finance.ledger`, `system.outbox_events`, `tracking.events_raw`).
*   **Justificativa:** Ocupa 8 bytes contra 16 bytes do UUID. Reduz a pegada do índice pela metade, mantendo a maior densidade possível na memória RAM (Cache-Line friendly). O limite é de 9 quintilhões, o que jamais estourará. É gerado nativamente pelo PG10+ de maneira atômica e performática sem a sujeira do `SERIAL`.

### SMALLINT
*   **Onde usar:** Dicionários imutáveis (Ex: `status_id`, `role_id`).
*   **Justificativa:** Ocupa apenas 2 bytes. Em bilhões de registros no `events_raw`, economizar 2 bytes por linha representa dezenas de Gigabytes economizados no disco e RAM na leitura analítica.

### TEXT Keys
*   **Onde usar:** Limitadíssimo a tabelas de configurações curtas (Ex: `system.feature_flags`, `system.settings`). Jamais usar TEXT/VARCHAR como chaves em tabelas relacionais volumosas, devido ao overhead de verificação de Collation.

---

## 3. Estratégia de Índices

### B-Tree e Compostos (Multi-Column)
*   Todo índice secundário em tabelas grandes que atenda mais de um critério de ordenação ou filtragem no WHERE deve ser composto, sempre ordenando as colunas no índice por: 1) Igualdade Estrita (`=`), 2) Range (`>`, `<`), 3) Ordenação.

### Parciais (Partial Indexes)
*   **Regra de Ouro:** Usados em booleanos assíncronos (Ex: `system.outbox_events` apenas nas linhas `WHERE processed_at IS NULL`).
*   **Por quê:** Transforma um índice de 50 milhões de registros para as apenas 2.000 mensagens que ainda estão pendentes. Leitura ultra-rápida, menor lock, I/O irrisório.

### INCLUDE (Covering Indexes)
*   **Estratégia:** Adicionar a palavra `INCLUDE (col_nome)` no final de um B-Tree se uma query de altíssima concorrência buscar essa coluna especificamente (Ex: buscar `email` pelo `id` do usuário). Isso permite o *Index-Only Scan*, evitando a leitura do Heap do banco e poupando chamadas de disco.

### GIN e BRIN
*   **GIN:** Usado no Ledger e Events em colunas de metadados (`payload` em formato JSONB) para busca reversa de chaves/valores via indexação invertida.
*   **BRIN (Block Range Index):** Obrigatório em tabelas de Bilhões de Registros ordenadas por tempo (`tracking.events_raw`). Um B-Tree de data consome Gigabytes, enquanto o BRIN resume "blocos" consumindo dezenas de Megabytes, tornando varreduras analíticas viáveis sem queimar recursos.

### Quando NÃO Indexar
*   Nunca indexe tabelas curtas (o PG otimiza via SeqScan de uma página em RAM).
*   Não indexe colunas altamente mutáveis (Ex: `balance` na tabela `Wallets` sem uso estrito WHERE), isso mata o HOT Updates (abordado no item 6).

---

## 4. Estratégia de Particionamento (Declarative Partitioning)

O particionamento gerencia a "Física" dos arquivos no disco sem o desenvolvedor (código lógico) precisar saber.

*   **`finance.ledger` (Ledger Transacional)**
    *   **Tipo:** RANGE particionado por mês cronológico.
    *   **Operação:** O Ledger é infinito e imutável. Queries analíticas de faturamento buscarão primariamente nas partições recentes. As partições de anos anteriores podem sofrer Re-Index em janelas sem bloquear os writes atuais.
*   **`tracking.events_raw` (Eventos Massivos)**
    *   **Tipo:** RANGE (Mensal).
    *   **Retenção (Archiving):** Ao completar 6 a 12 meses, as partições (físicas) serão movidas para Tablespaces (discos mais baratos, tipo AWS EBS Cold Storage) ou simplesmente truncadas no PG e exportadas nativamente como arquivos Parquet para o AWS S3/ClickHouse (Cold Storage Arquitetural).
*   **`system.outbox_events` (Transientes)**
    *   **Tipo:** SEM PARTICIONAMENTO (Inicialmente). Porém, como proteção a *Table Bloat* (item 12), em volumes absurdos podemos usar partições DIÁRIAS (Partitioned Outbox) de forma que, no final do dia, a partição do dia anterior é DROPPADA O(1) em milissegundos.

---

## 5. Estratégia de Concorrência

*   **Pessimistic Locking (FOR UPDATE)**
    *   **Onde:** Operações de Saque (`/withdraw`) em `finance.wallets`.
    *   **Motivo:** Se dois saques chegam no mesmo milissegundo, a primeira query "trava" a linha no banco, impedindo operações sujas simultâneas até finalizar o cálculo de saldo.
*   **O Motor da Fila (SKIP LOCKED)**
    *   **Onde:** Nos workers escutando o `system.outbox_events` e os Jobs em `system.jobs`.
    *   **Motivo:** Evita enfileiramento (Lock Contention). O worker 1 pega os registros [1-100], worker 2 pega os [101-200] simultaneamente, sem travar um ao outro. Alta vazão garantida na saída.
*   **NOWAIT**
    *   Usado quando falhar rápido (Fail Fast) for melhor que o timeout silencioso de fila na conexão do banco (Picos).
*   **Deadlocks (Prevenção)**
    *   O Backend e a ORM serão forçados a realizar "Lexical Sort" (ordenação primária) de entidades se a transação interagir com Múltiplas Wallets. (Sempre adquirir lock na ordem das PKs resolve deadlocks rotativos).
*   **Isolation Levels**
    *   Sistema base: `READ COMMITTED`.
    *   Relatórios Financeiros Fechados / Splits complexos de fechamento de mês: `REPEATABLE READ`, para garantir que nenhuma inserção "fantasma" apareça no meio do processamento da comissão mensal da modelo.

---

## 6. Estratégia de WAL e Tunning (Física de Armazenamento)

O PostgreSQL armazena a versão antiga ao dar UPDATE (MVCC). A Física exige contenção de "Bloat".
*   **HOT Updates (Heap-Only Tuples)**
    *   Atualizações na carteira ou nos contadores de vendas NÃO tocarão colunas indexadas. Isso permite ao PG reutilizar a página em disco sem refazer índices, salvando o I/O vertiginosamente.
*   **Fillfactor**
    *   Tabelas que recebem `UPDATE` rotineiro (`commerce.subscriptions`, `finance.wallets`) iniciarão com um `FILLFACTOR = 85`. Isso deixa 15% de cada página física vazia de propósito para receber as versões novas locais e engatilhar os HOT Updates, salvando a fragmentação inteira da tabela.
*   **Autovacuum (Agressividade)**
    *   Nosso tuning modificará as tabelas de alta flutuação (`system.outbox_events`). O padrão do Postgres (20% pra limpeza) é passivo demais. Ajustaremos o `autovacuum_vacuum_scale_factor` para `0.02` (2%), forçando o Vacuum a limpar tuplas mortas implacavelmente, impedindo inchaço.
*   **Checkpoint & WAL Size**
    *   Alargado. Em picos de transação, gerar checkpoints agressivos a cada 5m mata o servidor. O timeout deve ir para 15-30 mins em conjunto com um `max_wal_size` de altíssima escala.

---

## 7. Estratégia de Performance

*   **Connection Pool:** O uso do `PgBouncer` (Modo Transacional) é compulsório. Nenhuma API de Backend abrirá portas diretas nativas com o `postmaster`. A infraestrutura sustentará 5.000 requisições simultâneas em 150-200 conexões reais.
*   **Prepared Statements:** Como o PgBouncer em modo Transaction não suporta Named Prepared Statements de forma plena via protocolo clássico, o backend deve ser rigoroso ou a topologia pode suportar Poolers de Sessão dedicados às analises pesadas e Transaction pools ao OLTP.
*   **Materialized Views (Dashboards)**
    *   A Home de métricas das Criadoras e Afiliados não rodará count() ou SUM() sobre bilhões de linhas.
    *   Usaremos Materialized Views com o comando `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Ele cria o snapshot no background sem dar lock no front.

---

## 8. Estratégia de Integridade

*   **Foreign Keys Implacáveis:** Toda chave relacional será vinculada, mantendo o ecossistema são.
*   **FK Locks:** Nenhuma tabela de bilhão de linhas analítica (ex: logs massivos) terá um vínculo real (FK) forte apontando e travando um usuário comum (`members`), impedindo Updates ou causandos deadlocks.
*   **CHECK constraints:** Salvar o erro no berço. (Ex: Saldo nunca `< 0`, Comissões totais nunca `> 100`, Preço sempre `>= 0`). Se o código estiver com bug de cálculo, o banco rebate o erro ACID-style.
*   **NOT NULL:** NULLs criam ramificações perigosas nas querys. Toda flag binária ou texto será NOT NULL com Defaults corretos ou impedidos por infra.

---

## 9. Estratégia de Observabilidade

*   **pg_stat_statements:** Habilitado em PRD perpetuamente (overhead baixíssimo - 1%). Nos dará as top queries que consomem I/O ou CPU, para criar indexações emergenciais sem adivinhações.
*   **Slow Queries:** `log_min_duration_statement` apontado para 500ms inicialmente, caindo a 200ms na estabilização.
*   **Wraparound & Bloat Monitoring:** Alertas no Grafana/Prometheus integrados via Exporter: monitorar o XID Wraparound do PostgreSQL e o Ratio de Table Bloat (especialmente do Outbox).

---

## 10. Estratégia de Backup (Disaster Recovery)

*   **Lógico vs Físico:** `pg_dump` serve apenas para testes locais de devs e extração de dicionários. Para o volume Enterprise, Backups Físicos via **WAL Archiving (Ex: pgBackRest, WAL-G)** contínuos no S3 são mandatórios.
*   **Point in Time Recovery (PITR):** Se o banco for invadido no Sábado às 14:02:15. Subimos uma cópia idêntica no Sábado às 14:02:14. Recuperação granular garantida.
*   **Restore Automático:** A infraestrutura DevOps rodará testes periódicos automatizados em instâncias isoladas, garantindo que o backup criptografado guardado possui saúde real para ser restaurado em 30 min num incidente catastrófico.

---

## 11. Estratégia de Migrações (Zero-Downtime)

A partir do Architecture Freeze v1.0, o schema passará por evolução.
*   **Regras Rigorosas:**
    *   É proibido criar um Índice B-Tree gigante sem `CONCURRENTLY`.
    *   É proibido alterar (Alter Type) colunas gigantes sem estratégias em duas fases.
    *   Backward / Forward Compatibility: A API da Sprint X-1 NÃO DEVE QUEBRAR durante o momento de implantação do schema da Sprint X.
    *   As migrações seguem formato up/down determinístico.

---

## 12. Checklist Enterprise e Avaliação de Risco Brutal

| Avaliação de Eixo | Nota /10 | Fundamentação Enterprise |
| :--- | :---: | :--- |
| **Escalabilidade** | 9 | O uso de UUIDv7 com partições (RANGE) resolve a fragmentação física. Read-Replicas desoneram a Base Master. |
| **Integridade** | 10 | Abandono de Polimorfismo, FKs estritas, Ledger 100% Append-only e CHECK Constraints garantem nível bancário. |
| **Concorrência** | 9 | Pessimistic Lock (FOR UPDATE) + Polling de Workers (SKIP LOCKED) destroem colisões (Race Conditions). |
| **Disaster Recovery** | 10 | WAL Archiving agressivo ao S3, suporte a PITR milimétrico e snapshots Cloud-Native em blocos. |
| **Observabilidade** | 9 | Export via Prometheus de Locks Longos, Deadlocks Count, e Queries via `pg_stat_statements`. |
| **Performance** | 9 | Modelagem para HOT Updates via Fillfactor + Indexes Parciais focados em caudas quentes do processamento. |
| **Segurança** | 10 | Schemas hard-bounded. Ausência do search_path dinâmico impede Poisoning Attacks no Query Planner. |
| **Operação (VACUUM)** | 9 | Vacuum customizado agressivo no Transactional Outbox (Bloat Protection). |
| **Evolução (Zero DT)** | 9 | Regras estritas de Migrations forçam transições suaves compatíveis (Backwards Compatible). |
| **Custos (ROI Tech)** | 8 | Storage e particionamento inteligente economizam, mas a topologia exigirá I/O forte (IOPS caros de disco). |

### 🔥 Auditoria Brutal: Falhas Previstas em Escala de Bilhão e Mitigações Finais

1. **Gargalo no Worker de "Wallets" (Hot Row Contention Extremo)**
    *   *Falha Certa:* Se 50 mil compras acontecerem para o mesmo dono/afiliado em 1 minuto, 50 mil Workers do Outbox tentarão dar `FOR UPDATE` na MESMA carteira do dono. Fila gigantesca gerará Timeout da transação em cascata no backend.
    *   *Resolução Física Mapeada:* O processamento das atualizações no saldo das wallets sob pico será convertido de processo unitário síncrono para processamento via **Batch Debouncing**. O Worker consome o lote e emite um único UPDATE agregado para `balance = balance + TOTAL_BATCH` em transação única.
2. **Gargalo de I/O em Logs de Tracking (`events_raw`) vs Vacuum**
    *   *Falha Certa:* Uma tabela massiva, mesmo particionada por mês, atrelada a uma FK estrita (`member_id`), sofrerá I/O lock terrível (ExclusiveLock) se ocorrer a deleção (GDPR) ou atualização massiva de contas no `core`.
    *   *Resolução Física Mapeada:* Dados Analíticos em Massa (`events_raw`) NÃO RECEBERÃO Restrições Físicas Estrangeiras Diretas (`FOREIGN KEY (visitor_id) REFERENCES visitors (id)`). Para escalar logs de bilhões para trilhões sem locks mortais e I/O cross-tabelas, a integridade do Tracking será suportada via lógicas da camada de Ingestão de Lotes ou Soft-Deletes.
3. **Morte lenta do Transactional Outbox (MVCC Table Bloat)**
    *   *Falha Certa:* Inserir 50 milhões e apagar 50 milhões de mensagens no outbox diariamente, mesmo com Autovacuum 1%, deixará "buracos" físicos e tornará o seq_scan insustentável ao final de 3 meses.
    *   *Resolução Física Mapeada:* Aplicação do padrão **Partitioned Outbox Drop**. O Outbox será particionado de forma DIÁRIA. O Vacuum será dispensado. Ao amanhecer do dia D+2, a partição do dia D-0, já consumida na totalidade (0 mensagens não lidas) sofrerá `DROP PARTITION`, recuperando 100% de performance no filesystem de forma O(1) e instantânea.

O design físico atingiu o padrão arquitetural Enterprise, pronto para instanciar o schema sob estresse de alta concorrência contínua.