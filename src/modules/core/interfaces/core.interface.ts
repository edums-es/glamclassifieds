export interface IMember {
  id: string; // Matches auth.users UUID
  displayName: string;
  avatarUrl: string | null;
  isCreator: boolean;
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface IDevice {
  id: string;
  memberId: string;
  deviceId: string;
  fcmToken: string | null;
  lastActiveAt: Date;
}

export interface IUpdateMemberData {
  displayName?: string;
  avatarUrl?: string;
}
