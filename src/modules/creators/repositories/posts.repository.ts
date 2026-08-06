import { Injectable, Inject } from '@nestjs/common';
import { IPost, IPostMedia, ICreatePostData } from '../interfaces/posts.interface';
import { randomUUID } from 'crypto';
import { DbClient } from '../../../shared/database/schema';

@Injectable()
export class PostsRepository {
  constructor(@Inject('DB_CLIENT') private readonly db: DbClient) {}

  async createMediaPlaceholder(mediaKey: string, mediaType: 'image' | 'video'): Promise<IPostMedia> {
    const id = randomUUID();
    const now = new Date();
    
    const result = await this.db
      .insertInto('only_post_media')
      .values({
        id,
        post_id: null,
        media_key: mediaKey,
        media_type: mediaType,
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapMediaToEntity(result);
  }

  async findMediaByKey(mediaKey: string): Promise<IPostMedia | null> {
    const result = await this.db
      .selectFrom('only_post_media')
      .selectAll()
      .where('media_key', '=', mediaKey)
      .executeTakeFirst();

    return result ? this.mapMediaToEntity(result) : null;
  }

  async createPost(data: ICreatePostData): Promise<IPost> {
    const postId = randomUUID();
    const now = new Date();
    
    const postStatus: 'draft' | 'processing' | 'published' = 'published';

    // Begin a transaction to create the post and associate media
    const result = await this.db.transaction().execute(async (trx) => {
      const postResult = await trx
        .insertInto('only_posts')
        .values({
          id: postId,
          creator_id: data.creatorId,
          title: data.title,
          description: data.description || null,
          visibility: data.visibility,
          price_cents: data.visibility === 'paid' ? (data.priceCents || 0) : 0,
          status: postStatus,
          published_at: data.publishedAt || now,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (data.mediaKeys && data.mediaKeys.length > 0) {
        await trx
          .updateTable('only_post_media')
          .set({
            post_id: postId,
            status: 'ready',
            updated_at: now,
          })
          .where('media_key', 'in', data.mediaKeys)
          .execute();
      }

      return postResult;
    });

    return this.mapPostToEntity(result);
  }

  async findPostById(postId: string): Promise<IPost | null> {
    const result = await this.db
      .selectFrom('only_posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    return result ? this.mapPostToEntity(result) : null;
  }

  async findActivePostsByCreator(creatorId: string): Promise<IPost[]> {
    const now = new Date();
    const results = await this.db
      .selectFrom('only_posts')
      .selectAll()
      .where('creator_id', '=', creatorId)
      .where('status', '=', 'published')
      .where('published_at', '<=', now)
      .where('deleted_at', 'is', null)
      .execute();

    return results.map(this.mapPostToEntity);
  }

  async findAll(): Promise<IPost[]> {
    const results = await this.db
      .selectFrom('only_posts')
      .selectAll()
      .where('deleted_at', 'is', null)
      .execute();

    return results.map(this.mapPostToEntity);
  }

  async updatePost(postId: string, updates: Partial<Omit<IPost, 'id' | 'creatorId' | 'createdAt'>>): Promise<IPost | null> {
    const dbUpdates: any = { updated_at: new Date() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;
    if (updates.priceCents !== undefined) dbUpdates.price_cents = updates.priceCents;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.publishedAt !== undefined) dbUpdates.published_at = updates.publishedAt;

    const result = await this.db
      .updateTable('only_posts')
      .set(dbUpdates)
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();

    return result ? this.mapPostToEntity(result) : null;
  }

  async softDeletePost(postId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('only_posts')
      .set({ deleted_at: new Date(), status: 'deleted', updated_at: new Date() })
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
      
    return Number(result.numUpdatedRows) > 0;
  }

  private mapPostToEntity(row: any): IPost {
    return {
      id: row.id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      visibility: row.visibility,
      priceCents: row.price_cents,
      status: row.status,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMediaToEntity(row: any): IPostMedia {
    return {
      id: row.id,
      postId: row.post_id,
      mediaKey: row.media_key,
      mediaType: row.media_type,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
