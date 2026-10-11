import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireRestaurantRole } from '../auth/decorators/restaurant-roles.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { User, UserDocument, UserRole } from '../database/schemas/user.schema.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateRestaurantDto } from './dto/create-restaurant.dto.js';
import {
  PublicRestaurantDto,
  RestaurantResponseDto,
} from './dto/restaurant-response.dto.js';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto.js';
import { RestaurantsService } from './restaurants.service.js';

@Controller('restaurants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  /**
   * Provision a new restaurant and optionally assign an owner.
   * Access: SUPER_ADMIN only.
   */
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRestaurant(
    @Body() createDto: CreateRestaurantDto,
    @CurrentUser() user: User,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.createRestaurant(
      createDto,
      (user as any)._id,
    );
  }

  /**
   * List restaurants where the authenticated user is an authorized member or Super Admin.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMyRestaurants(
    @CurrentUser() user: User,
  ): Promise<RestaurantResponseDto[]> {
    return this.restaurantsService.getMyRestaurants(user as UserDocument);
  }

  /**
   * Accept an invitation token to become staff/admin of a restaurant.
   */
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body() acceptDto: AcceptInvitationDto,
    @CurrentUser() user: User,
  ): Promise<{ message: string; restaurantId: string; role: UserRole }> {
    return this.restaurantsService.acceptInvitation(
      acceptDto,
      user as UserDocument,
    );
  }

  /**
   * Get restaurant details.
   * Public users receive safe published profile; staff/admin receive full details.
   */
  @Public()
  @Get(':restaurantId')
  @HttpCode(HttpStatus.OK)
  async getRestaurant(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user?: User,
  ): Promise<RestaurantResponseDto | PublicRestaurantDto> {
    return this.restaurantsService.getRestaurantById(
      restaurantId,
      user as UserDocument | undefined,
    );
  }

  /**
   * Update restaurant profile and operational settings.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Patch(':restaurantId')
  @HttpCode(HttpStatus.OK)
  async updateRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Body() updateDto: UpdateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.updateRestaurant(restaurantId, updateDto);
  }

  /**
   * Create single-use invitation for restaurant staff or owner.
   * Access: RESTAURANT_ADMIN for this restaurant or SUPER_ADMIN.
   */
  @RequireRestaurantRole([UserRole.RESTAURANT_ADMIN])
  @Post(':restaurantId/invitations')
  @HttpCode(HttpStatus.CREATED)
  async createInvitation(
    @Param('restaurantId') restaurantId: string,
    @Body() createInvitationDto: CreateInvitationDto,
    @CurrentUser() user: User,
  ): Promise<{
    invitationId: string;
    email: string;
    role: UserRole;
    expiresAt: Date;
    invitationToken: string;
  }> {
    return this.restaurantsService.createInvitation(
      restaurantId,
      createInvitationDto,
      (user as any)._id,
    );
  }
}
