import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CoreRepository } from '../repositories/core.repository';
import { UpdateProfileDto } from '../dto/core.dto';
import { IMember } from '../interfaces/core.interface';

@Injectable()
export class CoreService {
  constructor(private readonly coreRepository: CoreRepository) {}

  // Intended to be called via EventBus when Auth triggers 'auth.registered'
  async provisionMemberProfile(userId: string, displayName: string): Promise<IMember> {
    const existing = await this.coreRepository.findMemberById(userId);
    if (existing) {
      return existing; // Idempotency
    }
    return this.coreRepository.createMember(userId, displayName);
  }

  async getMyProfile(userId: string): Promise<IMember> {
    const member = await this.coreRepository.findMemberById(userId);
    if (!member) {
      throw new NotFoundException('Member profile not found');
    }
    if (member.status !== 'active') {
      throw new ForbiddenException('Member account is suspended');
    }
    return member;
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto): Promise<IMember> {
    // Ensure member exists and is active
    await this.getMyProfile(userId);

    const updateData = {
      ...(dto.display_name && { displayName: dto.display_name }),
      ...(dto.avatar_url && { avatarUrl: dto.avatar_url }),
    };

    const updated = await this.coreRepository.updateMember(userId, updateData);
    if (!updated) {
      throw new NotFoundException('Failed to update member profile');
    }
    
    return updated;
  }
}
