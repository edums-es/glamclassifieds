import { Test, TestingModule } from '@nestjs/testing';
import { TrackingService } from '../services/tracking.service';
import { TrackingRepository } from '../repositories/tracking.repository';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

describe('TrackingService', () => {
  let service: TrackingService;
  let repo: TrackingRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrackingService, TrackingRepository],
    }).compile();

    service = module.get<TrackingService>(TrackingService);
    repo = module.get<TrackingRepository>(TrackingRepository);
  });

  it('should generate a unique tracking link', async () => {
    const creatorId = randomUUID();
    const result = await service.createTrackingLink(creatorId, {
      name: 'Insta Bio',
      destination_type: 'post',
      destination_id: randomUUID(),
    });

    expect(result.code).toBeDefined();
    expect(result.code.length).toBe(6);
    expect(result.url).toContain(`https://thesex.online/l/${result.code}`);
  });

  it('should handle redirect and register click for new visitor', async () => {
    const creatorId = randomUUID();
    const linkResult = await service.createTrackingLink(creatorId, {
      name: 'Insta Bio',
      destination_type: 'profile',
      destination_id: creatorId,
    });

    const redirectResult = await service.handleRedirect(linkResult.code, {
      ip: '192.168.0.1',
      user_agent: 'Mozilla',
    });

    expect(redirectResult.url).toBe(`/profile/${creatorId}`);
    expect(redirectResult.visitorId).toBeDefined();
    expect(redirectResult.sessionId).toBeDefined();

    // Verify click was saved
    const stats = await service.getDashboardStats(creatorId);
    expect(stats.totalClicks).toBe(1);
    expect(stats.clicksToday).toBe(1);
  });

  it('should handle redirect for existing visitor and session', async () => {
    const creatorId = randomUUID();
    const linkResult = await service.createTrackingLink(creatorId, {
      name: 'Insta Bio',
      destination_type: 'post',
      destination_id: randomUUID(),
    });

    const knownVisitorId = randomUUID();
    const knownSessionId = randomUUID();

    const redirectResult = await service.handleRedirect(linkResult.code, {
      visitor_id: knownVisitorId,
      session_id: knownSessionId,
    });

    expect(redirectResult.visitorId).toBe(knownVisitorId);
    expect(redirectResult.sessionId).toBe(knownSessionId);
  });

  it('should throw NotFoundException for invalid tracking code', async () => {
    await expect(service.handleRedirect('INVALID', {})).rejects.toThrow(NotFoundException);
  });

  it('should accurately calculate dashboard stats', async () => {
    const creatorId = randomUUID();
    
    // Create 2 links
    const link1 = await service.createTrackingLink(creatorId, { name: 'L1', destination_type: 'profile', destination_id: creatorId });
    const link2 = await service.createTrackingLink(creatorId, { name: 'L2', destination_type: 'profile', destination_id: creatorId });

    // Simulate 3 clicks today
    await service.handleRedirect(link1.code, {});
    await service.handleRedirect(link1.code, {});
    await service.handleRedirect(link2.code, {});

    const stats = await service.getDashboardStats(creatorId);
    expect(stats.totalLinks).toBe(2);
    expect(stats.totalClicks).toBe(3);
    expect(stats.clicksToday).toBe(3);
    expect(stats.clicksYesterday).toBe(0); // We didn't mock time travel for yesterday in this basic test
  });
});
