import { Injectable, BadRequestException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { CommerceRepository } from '../repositories/commerce.repository';
import { PostsService } from '../../creators/services/posts.service';
import { CreateCheckoutDto, PaymentWebhookDto } from '../dto/commerce.dto';
import { StripeService } from './stripe.service';

@Injectable()
export class CommerceService {
  private readonly logger = new Logger(CommerceService.name);

  constructor(
    private readonly commerceRepository: CommerceRepository,
    private readonly postsService: PostsService,
    private readonly stripeService: StripeService // Injected Stripe Sandbox
  ) {}

  async createCheckout(buyerId: string, dto: CreateCheckoutDto, idempotencyKey?: string) {
    this.logger.log(`[CHECKOUT] Starting checkout for buyer ${buyerId}, item: ${dto.item_id}`);
    
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingOrder = await this.commerceRepository.findOrderByIdempotencyKey(idempotencyKey);
      if (existingOrder) {
        this.logger.warn(`[CHECKOUT] Idempotency hit for key ${idempotencyKey}`);
        const tx = await this.commerceRepository.findPendingTransactionByOrderId(existingOrder.id);
        return { order: existingOrder, clientSecret: tx?.gatewayTxId ? `${tx.gatewayTxId}_secret_mock` : null };
      }
    }

    // 2. Fetch the Post (Cross-module call)
    let post;
    try {
      post = await this.postsService.getPostById(dto.item_id);
    } catch (error) {
      this.logger.error(`[CHECKOUT] Item not found: ${dto.item_id}`);
      throw new NotFoundException('Item not found');
    }

    // 3. Validation
    if (post.status !== 'published') {
      throw new BadRequestException('This item is not available for purchase');
    }

    if (post.creatorId === buyerId) {
      throw new BadRequestException('Creators cannot buy their own posts');
    }
    
    if (post.visibility !== 'paid') {
      throw new BadRequestException('This item is not a paid item');
    }

    // 4. Double Purchase Check
    const hasAccess = await this.commerceRepository.hasPostAccess(buyerId, post.id);
    if (hasAccess) {
      this.logger.error(`[CHECKOUT] Conflict: Buyer ${buyerId} already has access to ${post.id}`);
      throw new ConflictException('You already have access to this item');
    }

    // Check for pending orders to avoid duplicate charges in-flight
    const existingOrders = await this.commerceRepository.findOrderByUserAndItem(buyerId, post.id, dto.item_type);
    const hasPendingOrCompleted = existingOrders.some(o => o.status === 'pending' || o.status === 'processing' || o.status === 'completed');
    if (hasPendingOrCompleted) {
      this.logger.error(`[CHECKOUT] Conflict: Buyer ${buyerId} has pending/completed orders for ${post.id}`);
      throw new ConflictException('You already have a pending or completed order for this item');
    }

    // 5. Create Order
    const order = await this.commerceRepository.createOrder({
      buyerId,
      creatorId: post.creatorId,
      itemId: post.id,
      itemType: 'post',
      amountCents: post.priceCents,
      idempotencyKey,
    });
    this.logger.log(`[CHECKOUT] Order created: ${order.id}`);

    // 6. Connect to Stripe Sandbox
    const stripeIntent = await this.stripeService.createPaymentIntent(post.priceCents, order.id);

    // 7. Save Transaction with Stripe ID
    const tx = await this.commerceRepository.createTransaction(order.id, post.priceCents);
    await this.commerceRepository.completeTransaction(tx.id, stripeIntent.gatewayTxId, 'pending');

    this.logger.log(`[CHECKOUT] Checkout completed successfully. returning clientSecret`);
    return {
      order,
      clientSecret: stripeIntent.clientSecret
    };
  }

  async processWebhook(dto: PaymentWebhookDto, signature?: string) {
    this.logger.log(`[WEBHOOK] Processing webhook for order ${dto.order_id}`);
    
    // Validate signature via Stripe Service
    if (signature) {
      await this.stripeService.validateWebhookSignature(dto, signature);
    }

    const order = await this.commerceRepository.findOrderById(dto.order_id);
    if (!order) {
      this.logger.error(`[WEBHOOK] Order not found: ${dto.order_id}`);
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'completed' || order.status === 'failed') {
      // Already processed, Idempotent webhook handling
      this.logger.log(`[WEBHOOK] Order ${order.id} already processed`);
      return { success: true, message: 'Already processed' };
    }

    const tx = await this.commerceRepository.findPendingTransactionByOrderId(order.id);
    if (!tx) {
      this.logger.error(`[WEBHOOK] No pending transaction for order: ${order.id}`);
      throw new BadRequestException('No pending transaction found for this order');
    }

    // Update TX and Order
    await this.commerceRepository.completeTransaction(tx.id, dto.gateway_tx_id, dto.status);
    
    if (dto.status === 'approved') {
      await this.commerceRepository.updateOrderStatus(order.id, 'completed');
      
      // Grant ACL Access
      if (order.itemType === 'post') {
        this.logger.log(`[ACL] Granting access to member ${order.buyerId} for post ${order.itemId}`);
        await this.commerceRepository.grantPostAccess(order.buyerId, order.itemId, order.id);
      }
    } else {
      this.logger.log(`[WEBHOOK] Order ${order.id} failed payment`);
      await this.commerceRepository.updateOrderStatus(order.id, 'failed');
    }

    return { success: true };
  }

  async checkPostAccess(memberId: string, postId: string): Promise<boolean> {
    return this.commerceRepository.hasPostAccess(memberId, postId);
  }
}
