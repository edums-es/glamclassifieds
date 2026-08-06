import { Module } from '@nestjs/common';
import { TrackingController, TrackingRedirectController } from './controllers/tracking.controller';
import { TrackingAdminController } from './controllers/tracking-admin.controller';
import { TrackingService } from './services/tracking.service';
import { TrackingRepository } from './repositories/tracking.repository';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [CoreModule],
  controllers: [TrackingController, TrackingRedirectController, TrackingAdminController],
  providers: [TrackingService, TrackingRepository],
  exports: [TrackingService],
})
export class TrackingModule {}
