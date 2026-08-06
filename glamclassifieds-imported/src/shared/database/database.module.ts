import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './schema';

@Global()
@Module({
  providers: [
    {
      provide: 'DB_CLIENT',
      useFactory: () => {
        // In a real app, connection string comes from ConfigService
        const dialect = new PostgresDialect({
          pool: new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 10,
          }),
        });

        return new Kysely<Database>({ dialect });
      },
    },
  ],
  exports: ['DB_CLIENT'],
})
export class DatabaseModule {}
