import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(2).max(100).optional(),
  avatar_url: z.string().url().optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
