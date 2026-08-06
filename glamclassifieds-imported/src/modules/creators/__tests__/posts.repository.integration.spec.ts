import { Test, TestingModule } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { PostsRepository } from '../repositories/posts.repository';
import { Database, DbClient } from '../../../shared/database/schema';

describe('PostsRepository (Integration)', () => {
  let container: StartedPostgreSqlContainer;
  let db: DbClient;
  let pool: Pool;
  let repository: PostsRepository;

  const CREATOR_ID = '00000000-0000-0000-0000-000000000001';

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

      CREATE TABLE only_post_media (
        id UUID PRIMARY KEY,
        post_id UUID REFERENCES only_posts(id),
        media_key VARCHAR(255) NOT NULL UNIQUE,
        media_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `.execute(db);

    // Instantiate the repository
    repository = new PostsRepository(db);
  });

  afterAll(async () => {
    await db.destroy();
    await pool.end();
    await container.stop();
  });

  beforeEach(async () => {
    // Clean up tables in correct order due to foreign keys
    await db.deleteFrom('only_post_media').execute();
    await db.deleteFrom('only_posts').execute();
    await db.deleteFrom('only_creator_profiles').execute();

    // Insert dummy creator for FK constraints
    await db.insertInto('only_creator_profiles').values({
      id: CREATOR_ID,
      member_id: 'test_member',
      username: 'test_creator',
      created_at: new Date(),
      updated_at: new Date()
    }).execute();
  });

  it('should create a media placeholder', async () => {
    const mediaKey = 'uploads/test-image.jpg';
    const media = await repository.createMediaPlaceholder(mediaKey, 'image');
    
    expect(media).toBeDefined();
    expect(media.mediaKey).toBe(mediaKey);
    expect(media.mediaType).toBe('image');
    expect(media.status).toBe('pending');
    expect(media.postId).toBeNull();
  });

  it('should create a post with associated media', async () => {
    // 1. Create media
    const mediaKey = 'uploads/video.mp4';
    await repository.createMediaPlaceholder(mediaKey, 'video');

    // 2. Create post linking the media
    const post = await repository.createPost({
      creatorId: CREATOR_ID,
      title: 'My Video Post',
      description: 'Check this out',
      visibility: 'paid',
      priceCents: 500,
      mediaKeys: [mediaKey]
    });

    expect(post).toBeDefined();
    expect(post.title).toBe('My Video Post');
    expect(post.creatorId).toBe(CREATOR_ID);
    expect(post.visibility).toBe('paid');
    expect(post.priceCents).toBe(500);

    // 3. Verify media was linked
    const linkedMedia = await repository.findMediaByKey(mediaKey);
    expect(linkedMedia).toBeDefined();
    expect(linkedMedia?.postId).toBe(post.id);
    expect(linkedMedia?.status).toBe('ready');
  });

  it('should find active posts by creator', async () => {
    // Create a published post in the past
    await repository.createPost({
      creatorId: CREATOR_ID,
      title: 'Active Post',
      visibility: 'public',
      mediaKeys: [],
      publishedAt: new Date(Date.now() - 10000) // 10 seconds ago
    });

    // Create a post published in the future
    await repository.createPost({
      creatorId: CREATOR_ID,
      title: 'Future Post',
      visibility: 'public',
      mediaKeys: [],
      publishedAt: new Date(Date.now() + 10000) // 10 seconds in future
    });

    const activePosts = await repository.findActivePostsByCreator(CREATOR_ID);
    
    expect(activePosts).toHaveLength(1);
    expect(activePosts[0].title).toBe('Active Post');
  });

  it('should find a post by id', async () => {
    const created = await repository.createPost({
      creatorId: CREATOR_ID,
      title: 'Searchable Post',
      visibility: 'subscribers',
      mediaKeys: []
    });

    const found = await repository.findPostById(created.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe('Searchable Post');
  });

  it('should update a post', async () => {
    const post = await repository.createPost({
      creatorId: CREATOR_ID,
      title: 'Old Title',
      visibility: 'public',
      mediaKeys: []
    });

    const updated = await repository.updatePost(post.id, {
      title: 'New Title',
      priceCents: 1000,
      visibility: 'paid'
    });

    expect(updated).toBeDefined();
    expect(updated?.title).toBe('New Title');
    expect(updated?.priceCents).toBe(1000);
    expect(updated?.visibility).toBe('paid');
  });

  it('should soft delete a post and make it inaccessible', async () => {
    const post = await repository.createPost({
      creatorId: CREATOR_ID,
      title: 'To be deleted',
      visibility: 'public',
      mediaKeys: []
    });

    // Verify it exists
    const found1 = await repository.findPostById(post.id);
    expect(found1).toBeDefined();

    // Soft delete
    const deleted = await repository.softDeletePost(post.id);
    expect(deleted).toBe(true);

    // Verify it can no longer be accessed by normal find methods
    const found2 = await repository.findPostById(post.id);
    expect(found2).toBeNull();

    const allPosts = await repository.findAll();
    expect(allPosts.find(p => p.id === post.id)).toBeUndefined();
    
    const activePosts = await repository.findActivePostsByCreator(CREATOR_ID);
    expect(activePosts.find(p => p.id === post.id)).toBeUndefined();
  });

  it('should handle concurrent insertions correctly (unique media keys)', async () => {
    const mediaKey = 'uploads/concurrent.jpg';
    
    await repository.createMediaPlaceholder(mediaKey, 'image');

    // Attempt to insert the same media key again
    await expect(repository.createMediaPlaceholder(mediaKey, 'image')).rejects.toThrow();
  });
});
