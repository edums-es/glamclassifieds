import { Kysely } from 'kysely';

export interface Database {
  only_creator_profiles: {
    id: string; // UUID
    member_id: string;
    username: string; // UNIQUE
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    status: 'active' | 'suspended' | 'pending_verification';
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
  };
  only_posts: {
    id: string; // UUID
    creator_id: string; // UUID (references only_creator_profiles.id)
    title: string;
    description: string | null;
    visibility: 'public' | 'subscribers' | 'paid';
    price_cents: number;
    status: 'draft' | 'processing' | 'published' | 'deleted';
    published_at: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
  };
  only_post_media: {
    id: string; // UUID
    post_id: string | null; // UUID (references only_posts.id)
    media_key: string; // UNIQUE
    media_type: 'image' | 'video';
    status: 'pending' | 'processing' | 'ready' | 'failed';
    created_at: Date;
    updated_at: Date;
  };
  only_orders: {
    id: string; // UUID
    buyer_id: string;
    creator_id: string; // UUID references creator
    item_id: string;
    item_type: 'post' | 'subscription' | 'tip';
    amount_cents: number;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    idempotency_key: string; // UNIQUE
    created_at: Date;
    updated_at: Date;
  };
  only_transactions: {
    id: string; // UUID
    order_id: string; // UUID references orders
    gateway_tx_id: string | null; // UNIQUE
    status: 'pending' | 'success' | 'failed';
    amount_cents: number;
    created_at: Date;
  };
  only_post_access: {
    id: string; // UUID
    member_id: string;
    post_id: string; // UUID references posts
    order_id: string; // UUID references orders
    granted_at: Date;
  };
}

export type DbClient = Kysely<Database>;

