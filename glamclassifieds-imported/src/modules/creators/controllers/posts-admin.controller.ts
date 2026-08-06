import { Controller, Get, Headers } from '@nestjs/common';
import { PostsService } from '../services/posts.service';
import { PostsRepository } from '../repositories/posts.repository';
import { AdminAuthProvider } from '../../core/providers/admin-auth.provider';

@Controller('admin/posts')
export class PostsAdminController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postsRepository: PostsRepository,
    private readonly adminAuth: AdminAuthProvider
  ) {}

  @Get()
  async listAllPosts(@Headers('authorization') authHeader: string) {
    this.adminAuth.validateAdmin(authHeader);
    return this.postsRepository.findAll();
  }
}
