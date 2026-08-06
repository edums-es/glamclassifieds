import { Injectable } from '@nestjs/common';
import { IMember, IDevice, IUpdateMemberData } from '../interfaces/core.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class CoreRepository {
  private members = new Map<string, IMember>();
  private devices = new Map<string, IDevice>();

  async createMember(id: string, displayName: string): Promise<IMember> {
    const member: IMember = {
      id,
      displayName,
      avatarUrl: null,
      isCreator: false,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.members.set(id, member);
    return member;
  }

  async findMemberById(id: string): Promise<IMember | null> {
    return this.members.get(id) || null;
  }

  async updateMember(id: string, data: IUpdateMemberData): Promise<IMember | null> {
    const member = this.members.get(id);
    if (!member) return null;

    const updated = {
      ...member,
      ...data,
      updatedAt: new Date(),
    };
    this.members.set(id, updated);
    return updated;
  }

  async registerDevice(memberId: string, deviceId: string, fcmToken?: string): Promise<IDevice> {
    const id = randomUUID();
    const device: IDevice = {
      id,
      memberId,
      deviceId,
      fcmToken: fcmToken || null,
      lastActiveAt: new Date(),
    };
    this.devices.set(id, device);
    return device;
  }
}
