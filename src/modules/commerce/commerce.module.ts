import { Module } from '@nestjs/common';
import { CheckoutController } from './controllers/checkout.controller';
import { CommerceAdminController } from './controllers/commerce-admin.controller';
import { CommerceService } from './services/commerce.service';
import { StripeService } from './services/stripe.service';
import { CommerceRepository } from './repositories/commerce.repository';
import { CreatorsModule } from '../creators/creators.module';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [CreatorsModule, CoreModule],
  controllers: [CheckoutController, CommerceAdminController],
  providers: [CommerceService, StripeService, CommerceRepository],
  exports: [CommerceService],
})
export class CommerceModule {}
