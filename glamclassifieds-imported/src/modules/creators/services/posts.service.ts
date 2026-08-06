import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PostsRepository } from '../repositories/posts.repository';
import { CreatorsRepository } from '../repositories/creators.repository';
import { CreatePostDto, RequestPresignedUrlDto } from '../dto/posts.dto';
import { IPost, IPostMedia } from '../interfaces/posts.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class PostsService {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly creatorsRepository: CreatorsRepository
  ) {}

  async generatePresignedUploadUrl(memberId: string, dto: RequestPresignedUrlDto) {
    // 1. Verify Member is indeed a verified creator
    const creator = await this.creatorsRepository.findByMemberId(memberId);
    if (!creator || creator.status !== 'active') {
      throw new BadRequestException('Only active creators can upload media');
    }

    const mediaKey = randomUUID();
    const mediaType = dto.content_type.startsWith('video/') ? 'video' : 'image';

    // Register internal media pending row
    await this.postsRepository.createMediaPlaceholder(mediaKey, mediaType);

    // Mock Presigned URL generation for AWS S3
    const uploadUrl = `https://glamclassifieds-media.s3.amazonaws.com/${mediaKey}?signature=mocked_signature`;

    return {
      media_key: mediaKey,
      upload_url: uploadUrl,
    };
  }

  async createPost(memberId: string, dto: CreatePostDto): Promise<IPost> {
    // 1. Verify creator status
    const creator = await this.creatorsRepository.findByMemberId(memberId);
    if (!creator || creator.status !== 'active') {
      throw new BadRequestException('Only active creators can publish posts');
    }

    // 2. Validate PPV Pricing Constraints
    if (dto.visibility === 'paid' && (!dto.price_cents || dto.price_cents <= 0)) {
      throw new BadRequestException('Paid posts must contain a valid price greater than zero');
    }

    // 3. Verify that all referenced media exist and belong to the creator context
    for (const key of dto.media_keys) {
      const media = await this.postsRepository.findMediaByKey(key);
      if (!media) {
        throw new NotFoundException(`Media reference with key ${key} not found`);
      }
      if (media.postId !== null) {
        throw new BadRequestException(`Media ${key} is already attached to another post`);
      }
    }

    const publishedAtDate = dto.published_at ? new Date(dto.published_at) : new Date();

    return this.postsRepository.createPost({
      creatorId: memberId,
      title: dto.title,
      description: dto.description,
      visibility: dto.visibility,
      priceCents: dto.price_cents,
      mediaKeys: dto.media_keys,
      publishedAt: publishedAtDate,
    });
  }

  async getPostById(postId: string): Promise<IPost> {
    const post = await this.postsRepository.findPostById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async getCreatorFeed(username: string, viewerMemberId?: string): Promise<any[]> {
    const creator = await this.creatorsRepository.findByUsername(username);
    if (!creator || creator.status !== 'active') {
      throw new NotFoundException('Creator not found');
    }

    const posts = await this.postsRepository.findActivePostsByCreator(creator.memberId);
    
    // Process visibilities for the viewer (paid contents must obfuscate source if not bought)
    // Note: Commerce module will hook checkAccess here. For now, we mock the result.
    return posts.map(post => {
      if (post.visibility === 'paid') {
        const hasAccess = viewerMemberId === creator.memberId; // In future: commerceService.checkPostAccess(viewerMemberId, post.id)
        return {
          id: post.id,
          title: post.title,
          description: hasAccess ? post.description : '[LOCKED - PURCHASE REQUIRED]',
          visibility: post.visibility,
          price_cents: post.priceCents,
          is_locked: !hasAccess,
          media: hasAccess ? ['mocked_media_url'] : [],
        };
      }
      return {
        id: post.id,
        title: post.title,
        description: post.description,
        visibility: post.visibility,
        is_locked: false,
        media: ['mocked_media_url'],
      };
    });
  }
}
