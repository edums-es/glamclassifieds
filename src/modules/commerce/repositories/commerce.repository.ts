import { Injectable, Inject } from '@nestjs/common';
import { IOrder, ITransaction, IPostAccess, ICreateCheckoutData } from '../interfaces/commerce.interface';
import { randomUUID } from 'crypto';
import { DbClient } from '../../../shared/database/schema';

@Injectable()
export class CommerceRepository {
  constructor(@Inject('DB_CLIENT') private readonly db: DbClient) {}

  async findOrderByUserAndItem(buyerId: string, itemId: string, itemType: string): Promise<IOrder[]> {
    const results = await this.db
      .selectFrom('only_orders')
      .selectAll()
      .where('buyer_id', '=', buyerId)
      .where('item_id', '=', itemId)
      .where('item_type', '=', itemType as any)
      .execute();

    return results.map(this.mapOrderToEntity);
  }

  async findAllOrders(): Promise<IOrder[]> {
    const results = await this.db.selectFrom('only_orders').selectAll().execute();
    return results.map(this.mapOrderToEntity);
  }

  async findOrderByIdempotencyKey(key: string): Promise<IOrder | null> {
    const result = await this.db
      .selectFrom('only_orders')
      .selectAll()
      .where('idempotency_key', '=', key)
      .executeTakeFirst();
    return result ? this.mapOrderToEntity(result) : null;
  }

  async findOrderById(orderId: string): Promise<IOrder | null> {
    const result = await this.db
      .selectFrom('only_orders')
      .selectAll()
      .where('id', '=', orderId)
      .executeTakeFirst();
    return result ? this.mapOrderToEntity(result) : null;
  }

  async createOrder(data: ICreateCheckoutData): Promise<IOrder> {
    const orderId = randomUUID();
    const now = new Date();
    
    const result = await this.db
      .insertInto('only_orders')
      .values({
        id: orderId,
        buyer_id: data.buyerId,
        creator_id: data.creatorId,
        item_id: data.itemId,
        item_type: data.itemType,
        amount_cents: data.amountCents,
        status: 'pending',
        idempotency_key: data.idempotencyKey,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapOrderToEntity(result);
  }

  async updateOrderStatus(orderId: string, status: IOrder['status']): Promise<IOrder | null> {
    const result = await this.db
      .updateTable('only_orders')
      .set({ status, updated_at: new Date() })
      .where('id', '=', orderId)
      .returningAll()
      .executeTakeFirst();
    return result ? this.mapOrderToEntity(result) : null;
  }

  async createTransaction(orderId: string, amountCents: number): Promise<ITransaction> {
    const txId = randomUUID();
    const result = await this.db
      .insertInto('only_transactions')
      .values({
        id: txId,
        order_id: orderId,
        gateway_tx_id: null,
        status: 'pending',
        amount_cents: amountCents,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapTransactionToEntity(result);
  }

  async completeTransaction(txId: string, gatewayTxId: string, status: ITransaction['status']): Promise<ITransaction | null> {
    const result = await this.db
      .updateTable('only_transactions')
      .set({ gateway_tx_id: gatewayTxId, status })
      .where('id', '=', txId)
      .returningAll()
      .executeTakeFirst();
    return result ? this.mapTransactionToEntity(result) : null;
  }

  async findPendingTransactionByOrderId(orderId: string): Promise<ITransaction | null> {
    const result = await this.db
      .selectFrom('only_transactions')
      .selectAll()
      .where('order_id', '=', orderId)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    return result ? this.mapTransactionToEntity(result) : null;
  }

  async grantPostAccess(memberId: string, postId: string, orderId: string): Promise<IPostAccess> {
    const accessId = randomUUID();
    const result = await this.db
      .insertInto('only_post_access')
      .values({
        id: accessId,
        member_id: memberId,
        post_id: postId,
        order_id: orderId,
        granted_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapPostAccessToEntity(result);
  }

  async hasPostAccess(memberId: string, postId: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('only_post_access')
      .select('id')
      .where('member_id', '=', memberId)
      .where('post_id', '=', postId)
      .executeTakeFirst();
    return !!result;
  }

  private mapOrderToEntity(row: any): IOrder {
    return {
      id: row.id,
      buyerId: row.buyer_id,
      creatorId: row.creator_id,
      itemId: row.item_id,
      itemType: row.item_type,
      amountCents: row.amount_cents,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTransactionToEntity(row: any): ITransaction {
    return {
      id: row.id,
      orderId: row.order_id,
      gatewayTxId: row.gateway_tx_id,
      status: row.status,
      amountCents: row.amount_cents,
      createdAt: row.created_at,
    };
  }

  private mapPostAccessToEntity(row: any): IPostAccess {
    return {
      id: row.id,
      memberId: row.member_id,
      postId: row.post_id,
      orderId: row.order_id,
      grantedAt: row.granted_at,
    };
  }
}

