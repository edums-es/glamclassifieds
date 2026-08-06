import { z } from 'zod';

export const CreateCheckoutSchema = z.object({
  item_id: z.string().uuid(),
  item_type: z.enum(['post']),
});

export type CreateCheckoutDto = z.infer<typeof CreateCheckoutSchema>;

export const PaymentWebhookSchema = z.object({
  order_id: z.string().uuid(),
  gateway_tx_id: z.string(),
  status: z.enum(['approved', 'declined']),
});

export type PaymentWebhookDto = z.infer<typeof PaymentWebhookSchema>;
