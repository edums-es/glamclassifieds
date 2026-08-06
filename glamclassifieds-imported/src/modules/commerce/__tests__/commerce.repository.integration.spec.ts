import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { CommerceRepository } from '../repositories/commerce.repository';
import { Database, DbClient } from '../../../shared/database/schema';

describe('CommerceRepository (Integration)', () => {
  let container: StartedPostgreSqlContainer;
  let db: DbClient;
  let pool: Pool;
  let repository: CommerceRepository;

  const CREATOR_ID = '00000000-0000-0000-0000-000000000001';
  const BUYER_ID = 'mem_buyer_123';
  const POST_ID = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();

    pool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
      max: 20, // ensure enough connections for the concurrency test
    });

    const dialect = new PostgresDialect({ pool });
    db = new Kysely<Database>({ dialect });

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

      CREATE TABLE only_posts (
        id UUID PRIMARY KEY,
        creator_id UUID NOT NULL REFERENCES only_creator_profiles(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        visibility VARCHAR(50) NOT NULL,
        price_cents INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        published_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE only_orders (
        id UUID PRIMARY KEY,
        buyer_id VARCHAR(255) NOT NULL,
        creator_id UUID NOT NULL REFERENCES only_creator_profiles(id),
        item_id UUID NOT NULL REFERENCES only_posts(id),
        item_type VARCHAR(50) NOT NULL,
        amount_cents INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        idempotency_key VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE only_transactions (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES only_orders(id),
        gateway_tx_id VARCHAR(255) UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        amount_cents INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE only_post_access (
        id UUID PRIMARY KEY,
        member_id VARCHAR(255) NOT NULL,
        post_id UUID NOT NULL REFERENCES only_posts(id),
        order_id UUID NOT NULL REFERENCES only_orders(id),
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(member_id, post_id)
      );
    `.execute(db);

    repository = new CommerceRepository(db);
  });

  afterAll(async () => {
    await db.destroy();
    await pool.end();
    await container.stop();
  });

  beforeEach(async () => {
    await db.deleteFrom('only_post_access').execute();
    await db.deleteFrom('only_transactions').execute();
    await db.deleteFrom('only_orders').execute();
    await db.deleteFrom('only_posts').execute();
    await db.deleteFrom('only_creator_profiles').execute();

    await db.insertInto('only_creator_profiles').values({
      id: CREATOR_ID,
      member_id: 'test_creator',
      username: 'creator1',
      created_at: new Date(),
      updated_at: new Date()
    }).execute();

    await db.insertInto('only_posts').values({
      id: POST_ID,
      creator_id: CREATOR_ID,
      title: 'Premium Post',
      visibility: 'paid',
      price_cents: 1000,
      created_at: new Date(),
      updated_at: new Date()
    }).execute();
  });

  it('should create an order', async () => {
    const order = await repository.createOrder({
      buyerId: BUYER_ID,
      creatorId: CREATOR_ID,
      itemId: POST_ID,
      itemType: 'post',
      amountCents: 1000,
      idempotencyKey: 'idemp-1'
    });

    expect(order).toBeDefined();
    expect(order.buyerId).toBe(BUYER_ID);
    expect(order.idempotencyKey).toBe('idemp-1');

    const found = await repository.findOrderById(order.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe('pending');
  });

  it('should enforce idempotency on order creation (double purchase)', async () => {
    const checkoutData = {
      buyerId: BUYER_ID,
      creatorId: CREATOR_ID,
      itemId: POST_ID,
      itemType: 'post',
      amountCents: 1000,
      idempotencyKey: 'idemp-double'
    };

    await repository.createOrder(checkoutData);

    // Second attempt should fail due to UNIQUE idempotency_key
    await expect(repository.createOrder(checkoutData)).rejects.toThrow();
  });

  it('should create and update a transaction', async () => {
    const order = await repository.createOrder({
      buyerId: BUYER_ID,
      creatorId: CREATOR_ID,
      itemId: POST_ID,
      itemType: 'post',
      amountCents: 1000,
      idempotencyKey: 'idemp-tx'
    });

    const tx = await repository.createTransaction(order.id, 1000);
    expect(tx.status).toBe('pending');

    const completed = await repository.completeTransaction(tx.id, 'stripe_pi_123', 'success');
    expect(completed?.status).toBe('success');
    expect(completed?.gatewayTxId).toBe('stripe_pi_123');
  });

  it('should grant and verify post access (ACL)', async () => {
    const order = await repository.createOrder({
      buyerId: BUYER_ID,
      creatorId: CREATOR_ID,
      itemId: POST_ID,
      itemType: 'post',
      amountCents: 1000,
      idempotencyKey: 'idemp-acl'
    });

    const hasAccessBefore = await repository.hasPostAccess(BUYER_ID, POST_ID);
    expect(hasAccessBefore).toBe(false);

    await repository.grantPostAccess(BUYER_ID, POST_ID, order.id);

    const hasAccessAfter = await repository.hasPostAccess(BUYER_ID, POST_ID);
    expect(hasAccessAfter).toBe(true);
  });

  it('should fail webhook duplication (UNIQUE gateway_tx_id)', async () => {
    const order = await repository.createOrder({
      buyerId: BUYER_ID,
      creatorId: CREATOR_ID,
      itemId: POST_ID,
      itemType: 'post',
      amountCents: 1000,
      idempotencyKey: 'idemp-webhook'
    });

    const tx1 = await repository.createTransaction(order.id, 1000);
    await repository.completeTransaction(tx1.id, 'stripe_evt_unique', 'success');

    const tx2 = await repository.createTransaction(order.id, 1000);
    
    // Completing second tx with same gateway id should fail due to DB constraint
    await expect(
      repository.completeTransaction(tx2.id, 'stripe_evt_unique', 'success')
    ).rejects.toThrow();
  });

  it('should handle 50 concurrent checkout attempts gracefully', async () => {
    // We simulate 50 requests all trying to create an order with the same idempotency key at the same time
    const attempts = 50;
    const checkoutData = {
      buyerId: BUYER_ID,
      creatorId: CREATOR_ID,
      itemId: POST_ID,
      itemType: 'post',
      amountCents: 1000,
      idempotencyKey: 'idemp-concurrent-50'
    };

    const results = await Promise.allSettled(
      Array.from({ length: attempts }).map(() => repository.createOrder(checkoutData))
    );

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    // Only exactly ONE should succeed because of the idempotency_key UNIQUE constraint
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(49);
    
    // The successful one should give us our order id
    const orderId = (successes[0] as PromiseFulfilledResult<any>).value.id;

    // Simulate 50 webhook callbacks trying to complete the transaction and grant access
    const tx = await repository.createTransaction(orderId, 1000);

    const aclResults = await Promise.allSettled(
      Array.from({ length: attempts }).map(() => repository.grantPostAccess(BUYER_ID, POST_ID, orderId))
    );

    const aclSuccesses = aclResults.filter(r => r.status === 'fulfilled');
    const aclFailures = aclResults.filter(r => r.status === 'rejected');

    // Only exactly ONE ACL should be granted due to UNIQUE(member_id, post_id)
    expect(aclSuccesses).toHaveLength(1);
    expect(aclFailures).toHaveLength(49);
  });
  
  it('should demonstrate transaction rollback behavior', async () => {
     // If we needed to wrap order + tx in one Kysely transaction, this tests that rollback works.
     // In the current repository design, they are separate methods, but if we do a manual transaction test:
     
     const txAction = async () => {
       await db.transaction().execute(async (trx) => {
         const orderId = '00000000-0000-0000-0000-000000000003';
         await trx.insertInto('only_orders').values({
           id: orderId,
           buyer_id: BUYER_ID,
           creator_id: CREATOR_ID,
           item_id: POST_ID,
           item_type: 'post',
           amount_cents: 1000,
           idempotency_key: 'idemp-rollback',
         }).execute();
         
         // Intentional throw to rollback
         throw new Error('Force rollback');
       });
     };
     
     await expect(txAction()).rejects.toThrow('Force rollback');
     
     // Verify order was not saved
     const order = await repository.findOrderByIdempotencyKey('idemp-rollback');
     expect(order).toBeNull();
  });
});
