import { Controller, Get, Headers } from '@nestjs/common';
import { CommerceRepository } from '../repositories/commerce.repository';
import { AdminAuthProvider } from '../../core/providers/admin-auth.provider';

@Controller('admin/commerce')
export class CommerceAdminController {
  constructor(
    private readonly commerceRepository: CommerceRepository,
    private readonly adminAuth: AdminAuthProvider
  ) {}

  @Get('orders')
  async listAllOrders(@Headers('authorization') authHeader: string) {
    this.adminAuth.validateAdmin(authHeader);
    return this.commerceRepository.findAllOrders();
  }
}
