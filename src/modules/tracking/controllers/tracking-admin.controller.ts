import { Controller, Get, Headers } from '@nestjs/common';
import { TrackingRepository } from '../repositories/tracking.repository';
import { AdminAuthProvider } from '../../core/providers/admin-auth.provider';

@Controller('admin/tracking')
export class TrackingAdminController {
  constructor(
    private readonly trackingRepository: TrackingRepository,
    private readonly adminAuth: AdminAuthProvider
  ) {}

  @Get('links')
  async listAllLinks(@Headers('authorization') authHeader: string) {
    this.adminAuth.validateAdmin(authHeader);
    return this.trackingRepository.findAllLinks();
  }

  @Get('clicks')
  async listAllClicks(@Headers('authorization') authHeader: string) {
    this.adminAuth.validateAdmin(authHeader);
    return this.trackingRepository.findAllClicks();
  }
}
