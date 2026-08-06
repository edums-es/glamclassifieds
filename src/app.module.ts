import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CoreModule } from './modules/core/core.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { TrackingModule } from './modules/tracking/tracking.module';

@Module({
  imports: [AuthModule, CoreModule, CreatorsModule, CommerceModule, TrackingModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
