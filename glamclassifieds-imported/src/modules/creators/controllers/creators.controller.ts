import { Controller, Get, Patch, Post, Body, Param, UsePipes, Headers, UnauthorizedException } from '@nestjs/common';
import { CreatorsService } from '../services/creators.service';
import { CreatorOnboardingSchema, CreatorOnboardingDto, UpdateCreatorProfileSchema, UpdateCreatorProfileDto } from '../dto/creators.dto';
import { ZodValidationPipe } from '@/shared/observability/zod-validation.pipe';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  // TODO (Sprint 14): Refactor to use JwtAuthGuard to provide the authenticated user ID
  // Currently extracts the ID from the token for prototyping, pending proper JWT Guard implementation
  private getAuthenticatedUserId(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    return authHeader.split(' ')[1];
  }

  @Post('onboard')
  @UsePipes(new ZodValidationPipe(CreatorOnboardingSchema))
  async onboard(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreatorOnboardingDto
  ) {
    const memberId = this.getAuthenticatedUserId(authHeader);
    return this.creatorsService.onboardCreator(memberId, dto);
  }

  @Get('me')
  async getMyProfile(@Headers('authorization') authHeader: string) {
    const memberId = this.getAuthenticatedUserId(authHeader);
    return this.creatorsService.getMyCreatorProfile(memberId);
  }

  @Patch('me')
  @UsePipes(new ZodValidationPipe(UpdateCreatorProfileSchema))
  async updateMyProfile(
    @Headers('authorization') authHeader: string,
    @Body() dto: UpdateCreatorProfileDto
  ) {
    const memberId = this.getAuthenticatedUserId(authHeader);
    return this.creatorsService.updateMyProfile(memberId, dto);
  }

  // Public endpoint for profile discovery
  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.creatorsService.getCreatorByUsername(username);
  }
}
