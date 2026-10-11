import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { MembershipService } from '../auth/membership.service.js';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';
import {
  InvitationStatus,
  RestaurantInvitation,
  RestaurantInvitationDocument,
} from '../database/schemas/restaurant-invitation.schema.js';
import {
  PublicationStatus,
  Restaurant,
  RestaurantDocument,
} from '../database/schemas/restaurant.schema.js';
import { User, UserDocument, UserRole } from '../database/schemas/user.schema.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateRestaurantDto } from './dto/create-restaurant.dto.js';
import {
  PublicRestaurantDto,
  RestaurantResponseDto,
} from './dto/restaurant-response.dto.js';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto.js';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(RestaurantInvitation.name)
    private readonly invitationModel: Model<RestaurantInvitationDocument>,
    private readonly membershipService: MembershipService,
  ) {}

  /**
   * Provisions a new restaurant and optionally assigns an owner.
   * Restricted to SUPER_ADMIN.
   */
  async createRestaurant(
    dto: CreateRestaurantDto,
    actingSuperAdminId: string | Types.ObjectId,
  ): Promise<RestaurantResponseDto> {
    const existingSlug = await this.restaurantModel.findOne({ slug: dto.slug.toLowerCase().trim() });
    if (existingSlug) {
      throw new ConflictException(`A restaurant with slug '${dto.slug}' already exists`);
    }

    let resolvedOwnerId: Types.ObjectId | undefined;
    if (dto.ownerEmail) {
      const normalizedOwnerEmail = dto.ownerEmail.toLowerCase().trim();
      const existingUser = await this.userModel.findOne({ email: normalizedOwnerEmail });
      if (existingUser) {
        resolvedOwnerId = existingUser._id as Types.ObjectId;
      }
    }

    const restaurant = new this.restaurantModel({
      name: dto.name.trim(),
      slug: dto.slug.toLowerCase().trim(),
      description: dto.description?.trim(),
      contact: {
        email: dto.contact.email.toLowerCase().trim(),
        phone: dto.contact.phone.trim(),
        website: dto.contact.website?.trim(),
      },
      address: {
        street: dto.address.street.trim(),
        city: dto.address.city.trim(),
        state: dto.address.state.trim(),
        postalCode: dto.address.postalCode.trim(),
        country: dto.address.country?.trim() || 'India',
      },
      ownerId: resolvedOwnerId,
      publicationStatus: dto.publicationStatus || PublicationStatus.DRAFT,
      operationalStatus: dto.operationalStatus,
      currency: dto.currency?.trim() || 'INR',
      timezone: dto.timezone?.trim() || 'Asia/Kolkata',
    });

    const savedRestaurant = await restaurant.save();

    // If existing owner user was resolved, assign them RESTAURANT_ADMIN membership
    if (resolvedOwnerId) {
      await this.membershipService.assignMembership(
        actingSuperAdminId,
        resolvedOwnerId,
        savedRestaurant._id as Types.ObjectId,
        [UserRole.RESTAURANT_ADMIN],
      );
    } else if (dto.ownerEmail) {
      // Create pending invitation for the prospective owner
      await this.createInvitation(
        savedRestaurant._id.toString(),
        {
          email: dto.ownerEmail,
          role: UserRole.RESTAURANT_ADMIN,
        },
        actingSuperAdminId,
      );
    }

    return this.mapToResponseDto(savedRestaurant);
  }

  /**
   * Retrieves all restaurants accessible by the current authenticated user.
   */
  async getMyRestaurants(user: UserDocument): Promise<RestaurantResponseDto[]> {
    if (user.globalRoles?.includes(UserRole.SUPER_ADMIN)) {
      const allRestaurants = await this.restaurantModel.find().sort({ createdAt: -1 });
      return allRestaurants.map((r) => this.mapToResponseDto(r));
    }

    const restaurantIds = (user.memberships || []).map((m) => m.restaurantId);
    if (restaurantIds.length === 0) {
      return [];
    }

    const restaurants = await this.restaurantModel
      .find({ _id: { $in: restaurantIds } })
      .sort({ createdAt: -1 });

    return restaurants.map((r) => this.mapToResponseDto(r));
  }

  /**
   * Retrieves a single restaurant by ID.
   * If public, returns only published info.
   */
  async getRestaurantById(
    restaurantId: string,
    currentUser?: UserDocument,
  ): Promise<RestaurantResponseDto | PublicRestaurantDto> {
    const objectId = TenantHelper.toObjectId(restaurantId);
    const restaurant = await this.restaurantModel.findById(objectId);

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const isAuthorized =
      currentUser &&
      (currentUser.globalRoles?.includes(UserRole.SUPER_ADMIN) ||
        currentUser.memberships?.some((m) =>
          m.restaurantId.equals(objectId) &&
          (m.roles.includes(UserRole.RESTAURANT_ADMIN) ||
            m.roles.includes(UserRole.KITCHEN_STAFF) ||
            m.roles.includes(UserRole.WAITER)),
        ));

    if (isAuthorized) {
      return this.mapToResponseDto(restaurant);
    }

    // Public view: must be published
    if (restaurant.publicationStatus !== PublicationStatus.PUBLISHED) {
      throw new NotFoundException('Restaurant is not available to the public');
    }

    return this.mapToPublicDto(restaurant);
  }

  /**
   * Updates an existing restaurant's details.
   */
  async updateRestaurant(
    restaurantId: string,
    dto: UpdateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    const objectId = TenantHelper.toObjectId(restaurantId);
    const restaurant = await this.restaurantModel.findById(objectId);

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    if (dto.name !== undefined) restaurant.name = dto.name.trim();
    if (dto.description !== undefined) restaurant.description = dto.description?.trim();
    if (dto.contact !== undefined) {
      restaurant.contact = {
        email: dto.contact.email.toLowerCase().trim(),
        phone: dto.contact.phone.trim(),
        website: dto.contact.website?.trim(),
      };
    }
    if (dto.address !== undefined) {
      restaurant.address = {
        street: dto.address.street.trim(),
        city: dto.address.city.trim(),
        state: dto.address.state.trim(),
        postalCode: dto.address.postalCode.trim(),
        country: dto.address.country?.trim() || 'India',
      };
    }
    if (dto.publicationStatus !== undefined) restaurant.publicationStatus = dto.publicationStatus;
    if (dto.operationalStatus !== undefined) restaurant.operationalStatus = dto.operationalStatus;
    if (dto.currency !== undefined) restaurant.currency = dto.currency.trim();
    if (dto.timezone !== undefined) restaurant.timezone = dto.timezone.trim();

    const updated = await restaurant.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Generates a secure single-use invitation token for staff or owners.
   */
  async createInvitation(
    restaurantId: string,
    dto: CreateInvitationDto,
    inviterId: string | Types.ObjectId,
  ): Promise<{
    invitationId: string;
    email: string;
    role: UserRole;
    expiresAt: Date;
    invitationToken: string;
  }> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const restaurant = await this.restaurantModel.findById(rId);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    // Generate cryptographically random 32-byte hex token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = new this.invitationModel({
      restaurantId: rId,
      email: dto.email.toLowerCase().trim(),
      role: dto.role,
      tokenHash,
      invitedBy: TenantHelper.toObjectId(inviterId),
      expiresAt,
      status: InvitationStatus.PENDING,
    });

    const saved = await invitation.save();

    return {
      invitationId: saved._id.toString(),
      email: saved.email,
      role: saved.role,
      expiresAt: saved.expiresAt,
      invitationToken: rawToken,
    };
  }

  /**
   * Accepts an invitation and grants the authorized restaurant membership.
   */
  async acceptInvitation(
    dto: AcceptInvitationDto,
    currentUser: UserDocument,
  ): Promise<{ message: string; restaurantId: string; role: UserRole }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const invitation = await this.invitationModel
      .findOne({
        tokenHash,
        status: InvitationStatus.PENDING,
        expiresAt: { $gt: new Date() },
      })
      .select('+tokenHash');

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    // Verify invitation email matches accepting user email
    if (invitation.email !== currentUser.email.toLowerCase()) {
      throw new ForbiddenException(
        `Invitation was issued for '${invitation.email}', but you are authenticated as '${currentUser.email}'`,
      );
    }

    // Assign membership
    const existingMembership = currentUser.memberships?.find((m) =>
      m.restaurantId.equals(invitation.restaurantId),
    );

    if (existingMembership) {
      if (!existingMembership.roles.includes(invitation.role)) {
        existingMembership.roles.push(invitation.role);
      }
    } else {
      currentUser.memberships.push({
        restaurantId: invitation.restaurantId,
        roles: [invitation.role],
      });
    }

    await currentUser.save();

    // Mark invitation accepted
    invitation.status = InvitationStatus.ACCEPTED;
    await invitation.save();

    return {
      message: `Successfully accepted invitation for ${invitation.role}`,
      restaurantId: invitation.restaurantId.toString(),
      role: invitation.role,
    };
  }

  private mapToResponseDto(doc: RestaurantDocument): RestaurantResponseDto {
    return {
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      contact: {
        email: doc.contact.email,
        phone: doc.contact.phone,
        website: doc.contact.website,
      },
      address: {
        street: doc.address.street,
        city: doc.address.city,
        state: doc.address.state,
        postalCode: doc.address.postalCode,
        country: doc.address.country,
      },
      ownerId: doc.ownerId?.toString(),
      publicationStatus: doc.publicationStatus,
      operationalStatus: doc.operationalStatus,
      currency: doc.currency,
      timezone: doc.timezone,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }

  private mapToPublicDto(doc: RestaurantDocument): PublicRestaurantDto {
    return {
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      contact: {
        email: doc.contact.email,
        phone: doc.contact.phone,
        website: doc.contact.website,
      },
      address: {
        street: doc.address.street,
        city: doc.address.city,
        state: doc.address.state,
        postalCode: doc.address.postalCode,
        country: doc.address.country,
      },
      operationalStatus: doc.operationalStatus,
      currency: doc.currency,
      timezone: doc.timezone,
    };
  }
}
