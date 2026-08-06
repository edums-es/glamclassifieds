import { Test, TestingModule } from '@nestjs/testing';
import { CoreService } from '../services/core.service';
import { CoreRepository } from '../repositories/core.repository';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

describe('CoreService', () => {
  let service: CoreService;
  let repository: CoreRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoreService, CoreRepository],
    }).compile();

    service = module.get<CoreService>(CoreService);
    repository = module.get<CoreRepository>(CoreRepository);
  });

  describe('provisionMemberProfile', () => {
    it('should create a new member profile', async () => {
      const userId = randomUUID();
      const member = await service.provisionMemberProfile(userId, 'John Doe');
      
      expect(member.id).toBe(userId);
      expect(member.displayName).toBe('John Doe');
      expect(member.isCreator).toBe(false);
      expect(member.status).toBe('active');
    });

    it('should return existing member if already provisioned (idempotency)', async () => {
      const userId = randomUUID();
      await service.provisionMemberProfile(userId, 'John Doe');
      const member2 = await service.provisionMemberProfile(userId, 'John Doe Changed');
      
      // Should not update display name if it already existed
      expect(member2.displayName).toBe('John Doe');
    });
  });

  describe('getMyProfile', () => {
    it('should return profile if active', async () => {
      const userId = randomUUID();
      await service.provisionMemberProfile(userId, 'John Doe');
      
      const profile = await service.getMyProfile(userId);
      expect(profile.id).toBe(userId);
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      await expect(service.getMyProfile(randomUUID())).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if suspended', async () => {
      const userId = randomUUID();
      await service.provisionMemberProfile(userId, 'John Doe');
      
      // Manually suspend via repo mock
      const repo = (service as any).coreRepository;
      const member = await repo.findMemberById(userId);
      member.status = 'suspended';

      await expect(service.getMyProfile(userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMyProfile', () => {
    it('should update display name and avatar', async () => {
      const userId = randomUUID();
      await service.provisionMemberProfile(userId, 'John Doe');

      const updated = await service.updateMyProfile(userId, {
        display_name: 'Jane Doe',
        avatar_url: 'https://example.com/avatar.jpg'
      });

      expect(updated.displayName).toBe('Jane Doe');
      expect(updated.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      await expect(
        service.updateMyProfile(randomUUID(), { display_name: 'Jane' })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
