import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { CreatorsRepository } from '../repositories/creators.repository';
import { Database, DbClient } from '../../../shared/database/schema';

describe('CreatorsRepository (Integration)', () => {
  let container: StartedPostgreSqlContainer;
  let db: DbClient;
  let pool: Pool;
  let repository: CreatorsRepository;

  beforeAll(async () => {
    // 1. Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15-alpine').start();

    // 2. Setup database connection pool
    pool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    });

    const dialect = new PostgresDialect({ pool });
    db = new Kysely<Database>({ dialect });

    // 3. Create tables (Schema migration)
    await sql`
      CREATE TABLE only_creator_profiles (
        id UUID PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        display_name VARCHAR(255),
        bio TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `.execute(db);

    // 4. Instantiate the repository
    repository = new CreatorsRepository(db);
  });

  afterAll(async () => {
    await db.destroy();
    await pool.end();
    await container.stop();
  });

  afterEach(async () => {
    // Clean up data between tests
    await db.deleteFrom('only_creator_profiles').execute();
  });

  it('should create and retrieve a creator', async () => {
    const data = {
      memberId: 'mem_123',
      username: 'john_doe',
      bio: 'Hello world',
    };

    const creator = await repository.create(data);
    expect(creator).toBeDefined();
    expect(creator.username).toBe('john_doe');
    expect(creator.memberId).toBe('mem_123');

    const found = await repository.findByMemberId('mem_123');
    expect(found).toBeDefined();
    expect(found?.username).toBe('john_doe');
  });

  it('should prevent duplicate usernames (database constraint)', async () => {
    const data1 = { memberId: 'mem_1', username: 'duplicate' };
    const data2 = { memberId: 'mem_2', username: 'duplicate' };

    await repository.create(data1);

    await expect(repository.create(data2)).rejects.toThrow(); // Should throw DB unique constraint error
  });

  it('should find by username case-insensitively', async () => {
    await repository.create({ memberId: 'mem_1', username: 'JaneDoe' });

    const foundLower = await repository.findByUsername('janedoe');
    expect(foundLower).toBeDefined();
    expect(foundLower?.memberId).toBe('mem_1');

    const foundExact = await repository.findByUsername('JaneDoe');
    expect(foundExact).toBeDefined();
    expect(foundExact?.memberId).toBe('mem_1');
  });

  it('should update a creator profile', async () => {
    await repository.create({ memberId: 'mem_update', username: 'updater' });

    const updated = await repository.update('mem_update', {
      bio: 'Updated bio',
      avatarUrl: 'https://example.com/avatar.png'
    });

    expect(updated).toBeDefined();
    expect(updated?.bio).toBe('Updated bio');
    expect(updated?.avatarUrl).toBe('https://example.com/avatar.png');

    const found = await repository.findByMemberId('mem_update');
    expect(found?.bio).toBe('Updated bio');
  });
});
