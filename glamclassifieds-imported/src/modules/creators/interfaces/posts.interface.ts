export interface IPost {
  id: string; // UUIDv7
  creatorId: string; // references only.creator_profiles(memberId)
  title: string;
  description: string | null;
  visibility: 'public' | 'paid';
  priceCents: number; // 0 if public or standard subscription, >0 if individual PPV
  status: 'draft' | 'processing' | 'published';
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPostMedia {
  id: string; // UUIDv7
  postId: string | null; // Nullable if generated before post creation
  mediaKey: string; // S3 Key
  mediaType: 'image' | 'video';
  status: 'pending' | 'ready' | 'failed';
  createdAt: Date;
}

export interface ICreatePostData {
  creatorId: string;
  title: string;
  description?: string;
  visibility: 'public' | 'paid';
  priceCents?: number;
  mediaKeys: string[];
  publishedAt?: Date;
}
