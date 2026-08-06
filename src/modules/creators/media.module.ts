import { Module } from '@nestjs/common';
import { StorageService } from './services/storage.service';
import { MediaController } from './controllers/media.controller';

@Module({
  controllers: [MediaController],
  providers: [StorageService],
  exports: [StorageService],
})
export class MediaModule {}