import { Controller, Post, Get, Body, Param, UsePipes, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { PostsService } from '../services/posts.service';
import { CreatePostSchema, RequestPresignedUrlSchema, CreatePostDto, RequestPresignedUrlDto } from '../dto/posts.dto';
import { ZodValidationPipe } from '@/shared/observability/zod-validation.pipe';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // TODO (Sprint 14): Refactor to use JwtAuthGuard to provide the authenticated user ID
  // Currently extracts the ID from the token for prototyping, pending proper JWT Guard implementation
  private getAuthenticatedUserId(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    return authHeader.split(' ')[1];
  }

  @Post('upload-url')
  @UsePipes(new ZodValidationPipe(RequestPresignedUrlSchema))
  async requestUploadUrl(
    @Headers('authorization') authHeader: string,
    @Body() dto: RequestPresignedUrlDto
  ) {
    const memberId = this.getAuthenticatedUserId(authHeader);
    return this.postsService.generatePresignedUploadUrl(memberId, dto);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreatePostSchema))
  async createPost(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreatePostDto
  ) {
    const memberId = this.getAuthenticatedUserId(authHeader);
    return this.postsService.createPost(memberId, dto);
  }

  @Get('feed/:username')
  async getFeed(
    @Param('username') username: string,
    @Headers('authorization') authHeader?: string
  ) {
    let viewerId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      viewerId = authHeader.split(' ')[1];
    }
    return this.postsService.getCreatorFeed(username, viewerId);
  }
}
