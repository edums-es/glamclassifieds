import { z } from 'zod';

export const CreatorOnboardingSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric and underscores allowed'),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
});

export type CreatorOnboardingDto = z.infer<typeof CreatorOnboardingSchema>;

export const UpdateCreatorProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
});

export type UpdateCreatorProfileDto = z.infer<typeof UpdateCreatorProfileSchema>;
