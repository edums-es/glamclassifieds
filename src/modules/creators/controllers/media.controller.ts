import { Controller, Post, Body, Headers, UseGuards, Logger } from '@nestjs/common';
import { StorageService } from '../../creators/services/storage.service';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('upload-url')
  // @Throttle({ default: { limit: 10, ttl: 60000 } }) // Rate limit implementation
  async getUploadUrl(@Body() body: { fileName: string; mimeType: string }) {
    this.logger.log(`[UPLOAD] Requesting S3 presigned URL for ${body.fileName}`);
    // Generate S3 Presigned URL for direct upload
    const { uploadUrl, mediaKey } = await this.storageService.generatePresignedUploadUrl(body.fileName, body.mimeType);
    
    return {
      uploadUrl,
      mediaKey
    };
  }

  @Post('view-url')
  async getViewUrl(@Body() body: { mediaKey: string }) {
    this.logger.log(`[ACL VIEW] Requesting CloudFront Signed URL for ${body.mediaKey}`);
    // In a real flow, this endpoint checks ACL before generating the CloudFront Signed URL
    const signedUrl = await this.storageService.generateSignedViewerUrl(body.mediaKey);
    return { signedUrl };
  }
}
