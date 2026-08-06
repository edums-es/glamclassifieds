import { Controller, Post, Body, Headers, UnauthorizedException, UsePipes } from '@nestjs/common';
import { CommerceService } from '../services/commerce.service';
import { CreateCheckoutSchema, PaymentWebhookSchema, CreateCheckoutDto, PaymentWebhookDto } from '../dto/commerce.dto';
import { ZodValidationPipe } from '@/shared/observability/zod-validation.pipe';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly commerceService: CommerceService) {}

  // TODO (Sprint 14): Refactor to use JwtAuthGuard to provide the authenticated user ID
  // Currently extracts the ID from the token for prototyping, pending proper JWT Guard implementation
  private getAuthenticatedUserId(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    return authHeader.split(' ')[1];
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateCheckoutSchema))
  async createCheckout(
    @Headers('authorization') authHeader: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateCheckoutDto
  ) {
    const memberId = this.getAuthenticatedUserId(authHeader);
    return this.commerceService.createCheckout(memberId, dto, idempotencyKey);
  }

  @Post('webhook')
  @UsePipes(new ZodValidationPipe(PaymentWebhookSchema))
  async handleWebhook(@Body() dto: PaymentWebhookDto) {
    return this.commerceService.processWebhook(dto);
  }
}
