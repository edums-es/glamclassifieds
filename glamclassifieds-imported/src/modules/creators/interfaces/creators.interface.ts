export interface ICreator {
  memberId: string; // PK references core.members(id)
  username: string; // Unique Handle
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  status: 'active' | 'suspended' | 'pending_verification';
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateCreatorData {
  memberId: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface IUpdateCreatorData {
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}
