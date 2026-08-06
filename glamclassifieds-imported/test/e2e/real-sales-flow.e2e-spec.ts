import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import * as fs from 'fs';
import * as path from 'path';
import { CreatorsModule } from '../../src/modules/creators/creators.module';
import { CommerceModule } from '../../src/modules/commerce/commerce.module';
import { TrackingModule } from '../../src/modules/tracking/tracking.module';
import { CreatorsService } from '../../src/modules/creators/services/creators.service';
import { PostsService } from '../../src/modules/creators/services/posts.service';
import { TrackingService } from '../../src/modules/tracking/services/tracking.service';
import { CommerceService } from '../../src/modules/commerce/services/commerce.service';
import { DatabaseModule } from '../../src/shared/database/database.module';
import { Database } from '../../src/shared/database/schema';
import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Real E2E Full Sales Flow (PostgreSQL)', () => {
  let creatorsService: CreatorsService;
  let postsService: PostsService;
  let trackingService: TrackingService;
  let commerceService: CommerceService;
  
  let creatorMemberId: string;
  let buyerMemberId: string;
  let postId: string;
  let linkCode: string;
  let trackingUrl: string;
  let orderId: string;

  let container: StartedPostgreSqlContainer;
  let db: Kysely<Database>;
  let pool: Pool;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    // 1. Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    // 2. Setup connection string for DatabaseModule
    const connectionString = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
    process.env.DATABASE_URL = connectionString; // Inject for DatabaseModule

    // 3. Setup temporary Pool & Kysely to run migrations
    pool = new Pool({ connectionString });
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

    // 4. Run real migrations (V001 to V012)
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    const files = fs.readdirSync(migrationsDir).sort();
    
    // Some migrations might require dropping multiple statements if they contain complex PL/pgSQL
    // For simplicity in this test, we read the files and execute them directly.
    for (const file of files) {
      if (file.endsWith('.sql')) {
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          await db.executeQuery({ sql: sqlContent, parameters: [] } as any); // Using Kysely's internal raw execute
        } catch (e) {
            // Note: Kysely might have trouble with raw executeQuery for complex scripts.
            // Using pg Pool directly is safer for raw migration scripts
            const client = await pool.connect();
            try {
                await client.query(sqlContent);
            } finally {
                client.release();
            }
        }
      }
    }

    // 5. Initialize NestJS App
    moduleFixture = await Test.createTestingModule({
      imports: [DatabaseModule, CreatorsModule, CommerceModule, TrackingModule],
    }).compile();

    creatorsService = moduleFixture.get<CreatorsService>(CreatorsService);
    postsService = moduleFixture.get<PostsService>(PostsService);
    trackingService = moduleFixture.get<TrackingService>(TrackingService);
    commerceService = moduleFixture.get<CommerceService>(CommerceService);

    // The tables in real migrations might have slightly different names than the ones in Sprint 8-10.
    // Wait, the user mentioned using EXACTLY the DatabaseModule from Sprint 8.
    // The previous tests used "only_creator_profiles" but the real migration says "only.creators".
    // I need to patch the Kysely schema in this test or ensure it works. 
    // Wait, we are supposed to NOT change the Repositories if we can help it, BUT the prompt says: "Substituir o fluxo E2E atual por um fluxo utilizando PostgreSQL real ... Migrations reais (V001 até V012)".
    
    // We need to insert the members into the 'core.members' table first, because 'only.creators' has an FK to 'core.members'.
    creatorMemberId = randomUUID();
    buyerMemberId = randomUUID();
    
    await pool.query(`
        INSERT INTO core.members (id, email, password_hash) VALUES ($1, $2, $3);
    `, [creatorMemberId, 'creator@test.com', 'hash']);
    
    await pool.query(`
        INSERT INTO core.members (id, email, password_hash) VALUES ($1, $2, $3);
    `, [buyerMemberId, 'buyer@test.com', 'hash']);

    // Map Sprint 8-10 tables to Real Migrations if they differ, or just let it fail so we can fix the Repositories properly.
    // Wait, the prompt says: "Substituir o fluxo E2E atual por um fluxo utilizando PostgreSQL real ... Não modificar Controllers, Services, DTOs."
    // It doesn't forbid modifying Repositories again.
    // Let's actually look at the real migrations and update the schema.ts and Repositories to match them exactly!
    
  }, 60000); // 60s timeout for container pull

  afterAll(async () => {
    await moduleFixture?.close();
    await db?.destroy();
    await pool?.end();
    await container?.stop();
  });

  it('1. Creator onboards and creates a PPV Post', async () => {
    const creator = await creatorsService.createCreator({
      memberId: creatorMemberId,
      username: 'johndoe_exclusive',
    });
    expect(creator.username).toBe('johndoe_exclusive');

    const postsRepo = moduleFixture.get('PostsRepository');
    const media = await postsRepo.createMediaPlaceholder(randomUUID(), 'video');

    const post = await postsService.createPost(creatorMemberId, {
      title: 'Exclusive Weekend Vlog',
      description: 'Behind the scenes video',
      media_keys: [media.mediaKey],
      visibility: 'paid',
      price_cents: 2990,
    });

    expect(post.id).toBeDefined();
    expect(post.status).toBe('published');
    expect(post.priceCents).toBe(2990);
    postId = post.id;
  });

  it('2. Admin/Creator generates a Tracking Link for the Post', async () => {
    const link = await trackingService.createTrackingLink(creatorMemberId, {
      name: 'Instagram Promo',
      destination_type: 'post',
      destination_id: postId,
    });

    expect(link.code).toBeDefined();
    expect(link.url).toContain('thesex.online');
    linkCode = link.code;
    trackingUrl = link.url;
  });

  it('3. Buyer clicks the Tracking Link', async () => {
    const redirect = await trackingService.handleRedirect(linkCode, {
      ip: '192.168.0.100',
      user_agent: 'Safari/iOS',
      utm_source: 'instagram',
      utm_medium: 'stories',
    });

    expect(redirect.url).toBe(`/post/${postId}`);
    
    // Check if tracking counts correctly
    const stats = await trackingService.getDashboardStats(creatorMemberId);
    expect(stats.totalClicks).toBe(1);
  });

  it('4. Buyer initializes Checkout', async () => {
    const order = await commerceService.createCheckout(buyerMemberId, {
      item_id: postId,
      item_type: 'post',
    }, 'idemp-checkout-1');

    expect(order.id).toBeDefined();
    expect(order.status).toBe('pending');
    expect(order.amountCents).toBe(2990);
    orderId = order.id;
  });

  it('5. Negative scenario: Duplicate Checkout (Idempotency)', async () => {
    await expect(commerceService.createCheckout(buyerMemberId, {
      item_id: postId,
      item_type: 'post',
    }, 'idemp-checkout-1')).rejects.toThrow(); // Should fail DB unique constraint
  });

  it('6. Negative scenario: Creator buying own post', async () => {
    // Assuming the service or repository has this check, or we need to verify it.
    // The prompt says "Validar obrigatoriamente: creator comprando próprio post -> erro esperado".
    // Wait, we didn't add logic to the Service, it should be tested via E2E.
    // If the mock had this rule, let's test it.
    await expect(commerceService.createCheckout(creatorMemberId, {
      item_id: postId,
      item_type: 'post',
    }, 'idemp-checkout-creator')).rejects.toThrow();
  });

  it('7. Negative scenario: Buying archived/deleted post', async () => {
    // Let's create a post and delete it
    const postToDelete = await postsService.createPost(creatorMemberId, {
      title: 'To be deleted',
      visibility: 'paid',
      price_cents: 1000,
    });
    
    const postsRepo = moduleFixture.get('PostsRepository');
    await postsRepo.softDeletePost(postToDelete.id);

    await expect(commerceService.createCheckout(buyerMemberId, {
      item_id: postToDelete.id,
      item_type: 'post',
    }, 'idemp-checkout-deleted')).rejects.toThrow(); // Should fail because post is not found (deleted_at IS NOT NULL)
  });

  it('8. Webhook approves payment and ACL is granted', async () => {
    const response = await commerceService.processWebhook({
      order_id: orderId,
      gateway_tx_id: 'tx_stripe_987654321',
      status: 'approved',
    });

    expect(response.success).toBe(true);

    const hasAccess = await commerceService.checkPostAccess(buyerMemberId, postId);
    expect(hasAccess).toBe(true);
  });

  it('9. Negative scenario: Webhook duplication', async () => {
    await expect(commerceService.processWebhook({
      order_id: orderId,
      gateway_tx_id: 'tx_stripe_987654321', // Duplicate ID
      status: 'approved',
    })).rejects.toThrow();
  });
});
