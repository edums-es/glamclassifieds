import { z } from 'zod';

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  media_keys: z.array(z.string().uuid()).min(1),
  visibility: z.enum(['public', 'paid']),
  price_cents: z.number().int().nonnegative().optional(),
  published_at: z.string().datetime().optional(), // Scheduled publication
});

export type CreatePostDto = z.infer<typeof CreatePostSchema>;

export const RequestPresignedUrlSchema = z.object({
  file_name: z.string().min(1),
  content_type: z.string().regex(/^image\/|^video\//, 'Only images and videos are allowed'),
});

export type RequestPresignedUrlDto = z.infer<typeof RequestPresignedUrlSchema>;
