export interface IOrder {
  id: string; // UUIDv7
  buyerId: string;
  creatorId: string;
  itemId: string; // E.g. postId
  itemType: 'post'; // Extensible for other types
  amountCents: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction {
  id: string; // UUIDv7
  orderId: string;
  gatewayTxId: string | null;
  status: 'pending' | 'approved' | 'declined' | 'refunded';
  amountCents: number;
  createdAt: Date;
}

export interface IPostAccess {
  id: string; // UUIDv7
  memberId: string;
  postId: string;
  orderId: string;
  grantedAt: Date;
}

export interface ICreateCheckoutData {
  buyerId: string;
  creatorId: string;
  itemId: string;
  itemType: 'post';
  amountCents: number;
  idempotencyKey?: string;
}

export interface IPaymentWebhookMockData {
  orderId: string;
  gatewayTxId: string;
  status: 'approved' | 'declined';
}
