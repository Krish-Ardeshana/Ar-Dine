import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider.js';
import { LocalStorageProvider } from './providers/local-storage.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    LocalStorageProvider,
    CloudinaryStorageProvider,
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
