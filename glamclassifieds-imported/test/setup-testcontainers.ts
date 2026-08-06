import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

export async function setup() {
  pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
  redisContainer = await new RedisContainer('redis:7-alpine').start();

  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();
}

export async function teardown() {
  if (pgContainer) await pgContainer.stop();
  if (redisContainer) await redisContainer.stop();
}
