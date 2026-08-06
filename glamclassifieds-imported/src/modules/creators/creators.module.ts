import { Module, forwardRef } from '@nestjs/common';
import { CreatorsController } from './controllers/creators.controller';
import { PostsController } from './controllers/posts.controller';
import { MediaController } from './controllers/media.controller';
import { CreatorsAdminController } from './controllers/creators-admin.controller';
import { PostsAdminController } from './controllers/posts-admin.controller';
import { CreatorsService } from './services/creators.service';
import { PostsService } from './services/posts.service';
import { StorageService } from './services/storage.service';
import { CreatorsRepository } from './repositories/creators.repository';
import { PostsRepository } from './repositories/posts.repository';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [forwardRef(() => CoreModule)],
  controllers: [CreatorsController, PostsController, MediaController, CreatorsAdminController, PostsAdminController],
  providers: [CreatorsService, PostsService, StorageService, CreatorsRepository, PostsRepository],
  exports: [CreatorsService, PostsService, StorageService],
})
export class CreatorsModule {}
