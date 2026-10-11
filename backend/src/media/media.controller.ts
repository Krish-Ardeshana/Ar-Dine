import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequireRestaurantRole } from '../auth/decorators/restaurant-roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import {
  ImageMetadata,
  Model3DMetadata,
} from '../database/schemas/menu-item.schema.js';
import { UserRole } from '../database/schemas/user.schema.js';
import { MediaService } from './media.service.js';
import { UploadedFileDto } from './storage.interface.js';

@Controller('restaurants/:restaurantId/media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Upload and validate a dish image.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole(UserRole.RESTAURANT_ADMIN)
  @Post('upload-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDishImage(
    @Param('restaurantId') restaurantId: string,
    @UploadedFile() file: UploadedFileDto,
    @Body('altText') altText?: string,
  ): Promise<ImageMetadata> {
    return this.mediaService.uploadDishImage(
      restaurantId,
      file,
      altText,
    );
  }

  /**
   * Upload and validate a self-contained 3D GLB model.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole(UserRole.RESTAURANT_ADMIN)
  @Post('upload-model')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDishModel(
    @Param('restaurantId') restaurantId: string,
    @UploadedFile() file: UploadedFileDto,
  ): Promise<Model3DMetadata> {
    return this.mediaService.uploadDishModel(restaurantId, file);
  }

  /**
   * Delete media asset.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole(UserRole.RESTAURANT_ADMIN)
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteMedia(
    @Param('restaurantId') restaurantId: string,
    @Body('storageKey') storageKey: string,
  ): Promise<{ message: string }> {
    await this.mediaService.deleteMedia(restaurantId, storageKey);
    return { message: 'Asset successfully deleted' };
  }
}
