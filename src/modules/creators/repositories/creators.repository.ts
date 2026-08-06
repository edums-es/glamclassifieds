import { Injectable, Inject } from '@nestjs/common';
import { ICreator, ICreateCreatorData, IUpdateCreatorData } from '../interfaces/creators.interface';
import { randomUUID } from 'crypto';
import { DbClient } from '../../../shared/database/schema';

// PostgreSQL Repository representing the 'only.creator_profiles' table (V005)
@Injectable()
export class CreatorsRepository {
  constructor(@Inject('DB_CLIENT') private readonly db: DbClient) {}

  async findByMemberId(memberId: string): Promise<ICreator | null> {
    const result = await this.db
      .selectFrom('only_creator_profiles')
      .selectAll()
      .where('member_id', '=', memberId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    return result ? this.mapToEntity(result) : null;
  }

  async findByUsername(username: string): Promise<ICreator | null> {
    const result = await this.db
      .selectFrom('only_creator_profiles')
      .selectAll()
      .where('username', '=', username.toLowerCase())
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    return result ? this.mapToEntity(result) : null;
  }

  async findAll(): Promise<ICreator[]> {
    const results = await this.db
      .selectFrom('only_creator_profiles')
      .selectAll()
      .where('deleted_at', 'is', null)
      .execute();
      
    return results.map(this.mapToEntity);
  }

  async create(data: ICreateCreatorData): Promise<ICreator> {
    const creatorId = randomUUID();
    const now = new Date();

    const result = await this.db
      .insertInto('only_creator_profiles')
      .values({
        id: creatorId,
        member_id: data.memberId,
        username: data.username.toLowerCase(),
        display_name: null,
        bio: data.bio || null,
        avatar_url: data.avatarUrl || null,
        status: 'active', // Assuming auto-approve for the MVP
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToEntity(result);
  }

  async update(memberId: string, data: IUpdateCreatorData): Promise<ICreator | null> {
    const updates: any = { updated_at: new Date() };
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
    if (data.bannerUrl !== undefined) updates.banner_url = data.bannerUrl;

    const result = await this.db
      .updateTable('only_creator_profiles')
      .set(updates)
      .where('member_id', '=', memberId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();

    return result ? this.mapToEntity(result) : null;
  }

  private mapToEntity(row: any): ICreator {
    return {
      memberId: row.member_id,
      username: row.username,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      bannerUrl: row.banner_url || null, 
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
