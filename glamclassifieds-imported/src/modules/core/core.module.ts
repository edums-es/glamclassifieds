import { Module } from '@nestjs/common';
import { CoreController } from './controllers/core.controller';
import { HealthController } from './controllers/health.controller';
import { CoreService } from './services/core.service';
import { CoreRepository } from './repositories/core.repository';
import { AdminAuthProvider } from './providers/admin-auth.provider';

@Module({
  controllers: [CoreController, HealthController],
  providers: [CoreService, CoreRepository, AdminAuthProvider],
  exports: [CoreService, AdminAuthProvider],
})
export class CoreModule {}
