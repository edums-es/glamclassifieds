import { z } from 'zod';

export const CreateTrackingLinkSchema = z.object({
  name: z.string().min(1).max(255),
  destination_type: z.enum(['post', 'profile', 'checkout']),
  destination_id: z.string().uuid(),
});

export type CreateTrackingLinkDto = z.infer<typeof CreateTrackingLinkSchema>;

export const RegisterClickSchema = z.object({
  visitor_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  ip: z.string().optional(),
  user_agent: z.string().optional(),
  referer: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export type RegisterClickDto = z.infer<typeof RegisterClickSchema>;
