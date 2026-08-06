import { Test, TestingModule } from '@nestjs/testing';
import { CreatorsService } from '../services/creators.service';
import { CreatorsRepository } from '../repositories/creators.repository';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

describe('CreatorsService', () => {
  let service: CreatorsService;
  let repository: CreatorsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreatorsService, CreatorsRepository],
    }).compile();

    service = module.get<CreatorsService>(CreatorsService);
    repository = module.get<CreatorsRepository>(CreatorsRepository);
  });

  describe('onboardCreator', () => {
    it('should create a creator profile successfully', async () => {
      const memberId = randomUUID();
      const dto = { username: 'john_doe', bio: 'My first profile' };
      
      const creator = await service.onboardCreator(memberId, dto);
      
      expect(creator.memberId).toBe(memberId);
      expect(creator.username).toBe('john_doe');
      expect(creator.status).toBe('active');
    });

    it('should throw ConflictException if member is already a creator', async () => {
      const memberId = randomUUID();
      const dto = { username: 'john_doe' };
      
      await service.onboardCreator(memberId, dto);
      
      await expect(
        service.onboardCreator(memberId, { username: 'another_name' })
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if username is taken', async () => {
      const memberId1 = randomUUID();
      const memberId2 = randomUUID();
      
      await service.onboardCreator(memberId1, { username: 'john_doe' });
      
      await expect(
        service.onboardCreator(memberId2, { username: 'JOHN_DOE' }) // Case insensitive collision mock
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getCreatorByUsername', () => {
    it('should return public profile if active', async () => {
      const memberId = randomUUID();
      await service.onboardCreator(memberId, { username: 'public_star' });
      
      const profile = await service.getCreatorByUsername('public_star');
      expect(profile.username).toBe('public_star');
    });

    it('should throw NotFoundException if username does not exist', async () => {
      await expect(service.getCreatorByUsername('ghost')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if creator is suspended', async () => {
      const memberId = randomUUID();
      await service.onboardCreator(memberId, { username: 'bad_actor' });
      
      // Suspend manually
      const creator = await repository.findByMemberId(memberId);
      creator!.status = 'suspended';

      await expect(service.getCreatorByUsername('bad_actor')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMyProfile', () => {
    it('should update bio and avatar, keeping username immutable', async () => {
      const memberId = randomUUID();
      await service.onboardCreator(memberId, { username: 'cool_guy', bio: 'Old bio' });

      const updated = await service.updateMyProfile(memberId, {
        bio: 'New bio',
        avatar_url: 'http://image.com/me.png'
      });

      expect(updated.bio).toBe('New bio');
      expect(updated.avatarUrl).toBe('http://image.com/me.png');
      expect(updated.username).toBe('cool_guy');
    });
  });
});
