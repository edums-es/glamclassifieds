import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from '../services/posts.service';
import { PostsRepository } from '../repositories/posts.repository';
import { CreatorsRepository } from '../repositories/creators.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

describe('PostsService', () => {
  let service: PostsService;
  let postsRepo: PostsRepository;
  let creatorsRepo: CreatorsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostsService, PostsRepository, CreatorsRepository],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postsRepo = module.get<PostsRepository>(PostsRepository);
    creatorsRepo = module.get<CreatorsRepository>(CreatorsRepository);
  });

  describe('createPost', () => {
    it('should throw BadRequestException if member is not an active creator', async () => {
      const memberId = randomUUID();
      const dto = {
        title: 'Forbidden Post',
        visibility: 'public' as const,
        media_keys: [randomUUID()],
      };

      await expect(service.createPost(memberId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if media keys are not registered', async () => {
      const memberId = randomUUID();
      // Onboard creator
      await creatorsRepo.create({ memberId, username: 'test_creator' });

      const dto = {
        title: 'Missing Media Post',
        visibility: 'public' as const,
        media_keys: [randomUUID()],
      };

      await expect(service.createPost(memberId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should create post successfully with valid inputs', async () => {
      const memberId = randomUUID();
      await creatorsRepo.create({ memberId, username: 'test_creator' });

      const media = await postsRepo.createMediaPlaceholder(randomUUID(), 'image');

      const dto = {
        title: 'Great Post',
        visibility: 'public' as const,
        media_keys: [media.mediaKey],
      };

      const post = await service.createPost(memberId, dto);
      expect(post.title).toBe('Great Post');
      expect(post.status).toBe('published');
    });

    it('should throw BadRequestException for paid posts without pricing', async () => {
      const memberId = randomUUID();
      await creatorsRepo.create({ memberId, username: 'test_creator' });
      const media = await postsRepo.createMediaPlaceholder(randomUUID(), 'image');

      const dto = {
        title: 'Premium Content',
        visibility: 'paid' as const,
        media_keys: [media.mediaKey],
      };

      await expect(service.createPost(memberId, dto)).rejects.toThrow(BadRequestException);
    });
  });
});
