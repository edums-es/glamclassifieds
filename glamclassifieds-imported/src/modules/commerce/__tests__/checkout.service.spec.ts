import { Test, TestingModule } from '@nestjs/testing';
import { CommerceService } from '../services/commerce.service';
import { CommerceRepository } from '../repositories/commerce.repository';
import { PostsService } from '../../creators/services/posts.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';

describe('CommerceService (Adversarial Review)', () => {
  let service: CommerceService;
  let repo: CommerceRepository;
  let postsServiceMock: any;

  beforeEach(async () => {
    postsServiceMock = {
      getPostById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommerceService,
        CommerceRepository,
        {
          provide: PostsService,
          useValue: postsServiceMock,
        },
      ],
    }).compile();

    service = module.get<CommerceService>(CommerceService);
    repo = module.get<CommerceRepository>(CommerceRepository);
  });

  describe('Adversarial Scenarios', () => {
    it('Cannot buy an unpublished post (draft)', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'draft',
        priceCents: 1000,
      });

      await expect(
        service.createCheckout(buyerId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Cannot buy an unpublished post (processing)', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'processing',
        priceCents: 1000,
      });

      await expect(
        service.createCheckout(buyerId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Cannot buy an unpublished post (archived)', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'archived',
        priceCents: 1000,
      });

      await expect(
        service.createCheckout(buyerId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Cannot buy an unpublished post (deleted)', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'deleted',
        priceCents: 1000,
      });

      await expect(
        service.createCheckout(buyerId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Double Purchase: Should reject if user already bought the post', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'published',
        priceCents: 1000,
      });

      // Grant access beforehand
      await repo.grantPostAccess(buyerId, postId, randomUUID());

      await expect(
        service.createCheckout(buyerId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(ConflictException);
    });

    it('Simultaneous Purchase (Race Condition Mock): Should reject if order is pending', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'published',
        priceCents: 1000,
      });

      // Trigger first checkout
      await service.createCheckout(buyerId, { item_id: postId, item_type: 'post' });

      // Trigger second checkout instantly
      await expect(
        service.createCheckout(buyerId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(ConflictException);
    });

    it('Idempotency: Should return the exact same order on retry', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      const idempotencyKey = 'idemp-key-123';
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'published',
        priceCents: 1000,
      });

      const order1 = await service.createCheckout(buyerId, { item_id: postId, item_type: 'post' }, idempotencyKey);
      const order2 = await service.createCheckout(buyerId, { item_id: postId, item_type: 'post' }, idempotencyKey);

      expect(order1.id).toBe(order2.id);
    });

    it('Self-Purchase: Creator cannot buy their own post', async () => {
      const creatorId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: creatorId,
        visibility: 'paid',
        status: 'published',
        priceCents: 1000,
      });

      await expect(
        service.createCheckout(creatorId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Free Post: Cannot buy a public post', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'public',
        status: 'published',
        priceCents: 0,
      });

      await expect(
        service.createCheckout(buyerId, { item_id: postId, item_type: 'post' })
      ).rejects.toThrow(BadRequestException);
    });

    it('Webhook: Idempotency & ACL Grant', async () => {
      const buyerId = randomUUID();
      const postId = randomUUID();
      
      postsServiceMock.getPostById.mockResolvedValue({
        id: postId,
        creatorId: randomUUID(),
        visibility: 'paid',
        status: 'published',
        priceCents: 1000,
      });

      const order = await service.createCheckout(buyerId, { item_id: postId, item_type: 'post' });
      
      // First Webhook (Success)
      await service.processWebhook({
        order_id: order.id,
        gateway_tx_id: 'tx_123',
        status: 'approved',
      });

      const hasAccess = await service.checkPostAccess(buyerId, postId);
      expect(hasAccess).toBe(true);

      // Second Webhook (Duplicate)
      const res = await service.processWebhook({
        order_id: order.id,
        gateway_tx_id: 'tx_123',
        status: 'approved',
      });
      expect(res.message).toBe('Already processed');
    });
  });
});
