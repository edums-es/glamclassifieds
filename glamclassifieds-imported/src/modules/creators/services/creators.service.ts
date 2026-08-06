import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreatorsRepository } from '../repositories/creators.repository';
import { CreatorOnboardingDto, UpdateCreatorProfileDto } from '../dto/creators.dto';
import { ICreator } from '../interfaces/creators.interface';

@Injectable()
export class CreatorsService {
  constructor(private readonly creatorsRepository: CreatorsRepository) {}

  async onboardCreator(memberId: string, dto: CreatorOnboardingDto): Promise<ICreator> {
    // 1. Verify if user is already a creator
    const existing = await this.creatorsRepository.findByMemberId(memberId);
    if (existing) {
      throw new ConflictException('Member is already a creator');
    }

    // 2. Enforce Unique Username globally
    const usernameTaken = await this.creatorsRepository.findByUsername(dto.username);
    if (usernameTaken) {
      throw new ConflictException('Username is already taken');
    }

    // 3. Provision the creator profile
    // Note: In the real implementation (PostgreSQL), the event bus should emit 'creator.onboarded'
    // so the Core Module updates `core.members.is_creator = TRUE` asynchronously or via Transaction.
    return this.creatorsRepository.create({
      memberId,
      username: dto.username,
      bio: dto.bio,
      avatarUrl: dto.avatar_url,
      bannerUrl: dto.banner_url,
    });
  }

  async getMyCreatorProfile(memberId: string): Promise<ICreator> {
    const creator = await this.creatorsRepository.findByMemberId(memberId);
    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }
    this.ensureActive(creator);
    return creator;
  }

  async getCreatorByUsername(username: string): Promise<ICreator> {
    const creator = await this.creatorsRepository.findByUsername(username);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }
    this.ensureActive(creator);
    return creator;
  }

  async updateMyProfile(memberId: string, dto: UpdateCreatorProfileDto): Promise<ICreator> {
    const creator = await this.getMyCreatorProfile(memberId);
    
    // Username cannot be updated via this endpoint to prevent link rot / mapping issues
    const updateData = {
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.avatar_url !== undefined && { avatarUrl: dto.avatar_url }),
      ...(dto.banner_url !== undefined && { bannerUrl: dto.banner_url }),
    };

    const updated = await this.creatorsRepository.update(memberId, updateData);
    if (!updated) {
      throw new NotFoundException('Creator profile not found during update');
    }

    return updated;
  }

  private ensureActive(creator: ICreator): void {
    if (creator.status === 'suspended') {
      throw new ForbiddenException('Creator account is suspended');
    }
    if (creator.status === 'pending_verification') {
      throw new ForbiddenException('Creator account is pending verification');
    }
  }
}
