import { Test, TestingModule } from '@nestjs/testing';
import { CreatorsModule } from '../../src/modules/creators/creators.module';
import { CommerceModule } from '../../src/modules/commerce/commerce.module';
import { TrackingModule } from '../../src/modules/tracking/tracking.module';
import { CreatorsService } from '../../src/modules/creators/services/creators.service';
import { PostsService } from '../../src/modules/creators/services/posts.service';
import { TrackingService } from '../../src/modules/tracking/services/tracking.service';
import { CommerceService } from '../../src/modules/commerce/services/commerce.service';
import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { PostsRepository } from '../../src/modules/creators/repositories/posts.repository';

describe('E2E Full Sales Flow (Sprint 7)', () => {
  let creatorsService: CreatorsService;
  let postsService: PostsService;
  let trackingService: TrackingService;
  let commerceService: CommerceService;
  let postsRepo: PostsRepository;
  
  let creatorMemberId: string;
  let buyerMemberId: string;
  let postId: string;
  let linkCode: string;
  let trackingUrl: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule, CommerceModule, TrackingModule],
    }).compile();

    creatorsService = moduleFixture.get<CreatorsService>(CreatorsService);
    postsService = moduleFixture.get<PostsService>(PostsService);
    trackingService = moduleFixture.get<TrackingService>(TrackingService);
    commerceService = moduleFixture.get<CommerceService>(CommerceService);
    postsRepo = moduleFixture.get<PostsRepository>(PostsRepository);

    creatorMemberId = randomUUID();
    buyerMemberId = randomUUID();
  });

  it('1. Creator onboards and creates a PPV Post', async () => {
    // Onboard creator
    await creatorsService.createCreator({
      memberId: creatorMemberId,
      username: 'johndoe_exclusive',
    });

    // Generate Mock Media Key
    const media = await postsRepo.createMediaPlaceholder(randomUUID(), 'video');

    // Create Post
    const post = await postsService.createPost(creatorMemberId, {
      title: 'Exclusive Weekend Vlog',
      description: 'Behind the scenes video',
      media_keys: [media.mediaKey],
      visibility: 'paid',
      price_cents: 2990, // R$ 29,90
    });

    expect(post.id).toBeDefined();
    expect(post.status).toBe('published');
    expect(post.priceCents).toBe(2990);
    
    postId = post.id;
  });

  it('2. Admin/Creator generates a Tracking Link for the Post', async () => {
    const link = await trackingService.createTrackingLink(creatorMemberId, {
      name: 'Instagram Stories Promo',
      destination_type: 'post',
      destination_id: postId,
    });

    expect(link.code).toBeDefined();
    expect(link.url).toContain('thesex.online');

    linkCode = link.code;
    trackingUrl = link.url;
  });

  it('3. Buyer clicks the Tracking Link', async () => {
    const redirect = await trackingService.handleRedirect(linkCode, {
      ip: '192.168.0.100',
      user_agent: 'Safari/iOS',
      utm_source: 'instagram',
      utm_medium: 'stories',
    });

    expect(redirect.url).toBe(`/post/${postId}`);
    expect(redirect.visitorId).toBeDefined();
    expect(redirect.sessionId).toBeDefined();

    // Verify Dashboard counts the click
    const stats = await trackingService.getDashboardStats(creatorMemberId);
    expect(stats.totalClicks).toBe(1);
    expect(stats.clicksToday).toBe(1);
  });

  it('4. Buyer initializes Checkout', async () => {
    const order = await commerceService.createCheckout(buyerMemberId, {
      item_id: postId,
      item_type: 'post',
    }, 'idempotency-abc-123');

    expect(order.id).toBeDefined();
    expect(order.status).toBe('pending');
    expect(order.amountCents).toBe(2990);
    expect(order.buyerId).toBe(buyerMemberId);

    orderId = order.id;
  });

  it('5. Webhook approves payment and ACL is granted', async () => {
    // Confirm Webhook Mock
    const response = await commerceService.processWebhook({
      order_id: orderId,
      gateway_tx_id: 'tx_stripe_987654321',
      status: 'approved',
    });

    expect(response.success).toBe(true);

    // Verify Access Control List
    const hasAccess = await commerceService.checkPostAccess(buyerMemberId, postId);
    expect(hasAccess).toBe(true);
  });
});
