export interface ITrackingLink {
  id: string; // UUIDv7
  creatorId: string;
  code: string; // e.g. A8HF2K
  name: string;
  destinationType: 'post' | 'profile' | 'checkout';
  destinationId: string; // UUID of the post/profile
  createdAt: Date;
}

export interface IVisitor {
  id: string; // UUIDv7
  createdAt: Date;
}

export interface ISession {
  id: string; // UUIDv7
  visitorId: string;
  createdAt: Date;
}

export interface IClick {
  id: string; // UUIDv7
  visitorId: string;
  sessionId: string;
  trackingLinkId: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  timestamp: Date;
}

export interface ICreateTrackingLinkData {
  creatorId: string;
  name: string;
  destinationType: 'post' | 'profile' | 'checkout';
  destinationId: string;
}

export interface IDashboardStats {
  totalLinks: number;
  totalClicks: number;
  clicksToday: number;
  clicksYesterday: number;
}
