import { Controller, Get, Patch, Body, UsePipes, Headers, UnauthorizedException } from '@nestjs/common';
import { CoreService } from '../services/core.service';
import { UpdateProfileSchema, UpdateProfileDto } from '../dto/core.dto';
import { ZodValidationPipe } from '@/shared/observability/zod-validation.pipe';

@Controller('members')
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  // TODO (Sprint 14): Refactor to use JwtAuthGuard to provide the authenticated user ID
  // Currently extracts the ID from the token for prototyping, pending proper JWT Guard implementation
  private getAuthenticatedUserId(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    return authHeader.split(' ')[1];
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader: string) {
    const userId = this.getAuthenticatedUserId(authHeader);
    return this.coreService.getMyProfile(userId);
  }

  @Patch('me')
  @UsePipes(new ZodValidationPipe(UpdateProfileSchema))
  async updateMe(
    @Headers('authorization') authHeader: string,
    @Body() dto: UpdateProfileDto
  ) {
    const userId = this.getAuthenticatedUserId(authHeader);
    return this.coreService.updateMyProfile(userId, dto);
  }
}
