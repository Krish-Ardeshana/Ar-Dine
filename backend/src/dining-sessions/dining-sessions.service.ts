import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import crypto from 'node:crypto';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';
import {
  DiningSession,
  DiningSessionDocument,
  SessionStatus,
} from '../database/schemas/dining-session.schema.js';
import {
  AvailabilityStatus,
  MenuItem,
  MenuItemDocument,
  MenuItemPublicationStatus,
} from '../database/schemas/menu-item.schema.js';
import {
  PublicationStatus,
  Restaurant,
  RestaurantDocument,
} from '../database/schemas/restaurant.schema.js';
import {
  RestaurantTable,
  RestaurantTableDocument,
  TableStatus,
} from '../database/schemas/restaurant-table.schema.js';
import {
  OrderValidationResultDto,
  ValidatedOrderItemResponseDto,
} from './dto/order-validation-result.dto.js';
import { SessionResponseDto } from './dto/session-response.dto.js';
import { ValidateOrderDto } from './dto/validate-order.dto.js';

@Injectable()
export class DiningSessionsService {
  constructor(
    @InjectModel(DiningSession.name)
    private readonly sessionModel: Model<DiningSessionDocument>,
    @InjectModel(RestaurantTable.name)
    private readonly tableModel: Model<RestaurantTableDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
  ) {}

  /**
   * Helper to format session document into response DTO
   */
  private toResponseDto(
    session: DiningSessionDocument,
    tableNumber: string,
    restaurantName: string,
    restaurantSlug: string,
  ): SessionResponseDto {
    return {
      id: session._id.toString(),
      sessionToken: session.sessionToken,
      restaurantId: session.restaurantId.toString(),
      tableId: session.tableId.toString(),
      tableNumber,
      restaurantName,
      restaurantSlug,
      status: session.status,
      expiresAt: session.expiresAt,
      createdAt: (session as any).createdAt,
    };
  }

  /**
   * Starts or resumes an active dining session when a customer scans a table QR code.
   * Multi-customer behavior:
   * Diners sitting at the same physical table join the table's current ACTIVE session.
   * If no active session exists or the previous session has expired, a new session is initialized.
   */
  async getOrCreateActiveSession(
    slug: string,
    tableToken: string,
  ): Promise<SessionResponseDto> {
    const restaurant = await this.restaurantModel.findOne({
      slug: slug.trim().toLowerCase(),
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    if (restaurant.publicationStatus !== PublicationStatus.PUBLISHED) {
      throw new NotFoundException('Restaurant is currently unpublished');
    }

    const table = await this.tableModel.findOne({
      tableToken: tableToken.trim(),
    });

    if (!table || !TenantHelper.areObjectIdsEqual(table.restaurantId, restaurant._id)) {
      throw new NotFoundException('Table not found or invalid QR link');
    }

    if (table.isArchived || table.operationalStatus === TableStatus.OUT_OF_SERVICE) {
      throw new BadRequestException('Table is currently out of service');
    }

    const now = new Date();

    // Check if an ACTIVE session already exists for this table
    const existingSession = await this.sessionModel.findOne({
      restaurantId: restaurant._id,
      tableId: table._id,
      status: SessionStatus.ACTIVE,
    });

    if (existingSession) {
      if (existingSession.expiresAt > now) {
        // Return existing active session - multiple diners at the same table share the session
        return this.toResponseDto(
          existingSession,
          table.tableNumber,
          restaurant.name,
          restaurant.slug,
        );
      } else {
        // Mark previous session expired
        existingSession.status = SessionStatus.EXPIRED;
        await existingSession.save();
      }
    }

    // Initialize new dining session (2 hours default duration)
    const sessionLifetimeMs = 2 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + sessionLifetimeMs);
    const sessionToken = `ses_${crypto.randomBytes(24).toString('hex')}`;

    const newSession = new this.sessionModel({
      restaurantId: restaurant._id,
      tableId: table._id,
      sessionToken,
      status: SessionStatus.ACTIVE,
      expiresAt,
    });

    const savedSession = await newSession.save();

    // Mark table OCCUPIED if it was previously AVAILABLE
    if (table.operationalStatus === TableStatus.AVAILABLE) {
      table.operationalStatus = TableStatus.OCCUPIED;
      await table.save();
    }

    return this.toResponseDto(
      savedSession,
      table.tableNumber,
      restaurant.name,
      restaurant.slug,
    );
  }

  /**
   * Validates an active session token.
   * Performs application-level expiry check (independent of MongoDB TTL timing).
   */
  async validateSession(sessionToken: string): Promise<SessionResponseDto> {
    if (!sessionToken || sessionToken.trim().length === 0) {
      throw new UnauthorizedException('Missing session token');
    }

    const session = await this.sessionModel.findOne({
      sessionToken: sessionToken.trim(),
    });

    if (!session || session.status !== SessionStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or inactive dining session');
    }

    const now = new Date();
    if (session.expiresAt <= now) {
      session.status = SessionStatus.EXPIRED;
      await session.save();
      throw new UnauthorizedException('Dining session has expired. Please rescan the table QR code.');
    }

    const [restaurant, table] = await Promise.all([
      this.restaurantModel.findById(session.restaurantId),
      this.tableModel.findById(session.tableId),
    ]);

    if (!restaurant || !table) {
      throw new NotFoundException('Restaurant or table context no longer exists');
    }

    return this.toResponseDto(
      session,
      table.tableNumber,
      restaurant.name,
      restaurant.slug,
    );
  }

  /**
   * Authoritative cart and checkout revalidation.
   * Re-evaluates client cart items against live database prices, availability, and tenant boundaries.
   * Note: Order placement is scheduled for Phase 6; this endpoint enforces server-authoritative totals.
   */
  async validateCartOrder(
    slug: string,
    tableToken: string,
    dto: ValidateOrderDto,
  ): Promise<OrderValidationResultDto> {
    // 1. Verify active session
    const sessionContext = await this.validateSession(dto.sessionToken);

    // 2. Verify restaurant & table match
    const restaurant = await this.restaurantModel.findOne({
      slug: slug.trim().toLowerCase(),
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const table = await this.tableModel.findOne({
      tableToken: tableToken.trim(),
    });
    if (!table || !TenantHelper.areObjectIdsEqual(table.restaurantId, restaurant._id)) {
      throw new NotFoundException('Table mismatch');
    }

    if (
      sessionContext.restaurantId !== restaurant._id.toString() ||
      sessionContext.tableId !== table._id.toString()
    ) {
      throw new UnauthorizedException('Dining session does not match this table');
    }

    // 3. Revalidate each cart item against authoritative database records
    let subtotal = 0;
    const validatedItems: ValidatedOrderItemResponseDto[] = [];

    for (const requestedItem of dto.items) {
      const itemObjectId = TenantHelper.toObjectId(requestedItem.menuItemId);
      const menuItem = await this.menuItemModel.findById(itemObjectId);

      if (!menuItem) {
        throw new NotFoundException(`Dish not found: ${requestedItem.menuItemId}`);
      }

      if (!TenantHelper.areObjectIdsEqual(menuItem.restaurantId, restaurant._id)) {
        throw new BadRequestException(
          `Dish "${menuItem.name}" does not belong to this restaurant`,
        );
      }

      if (menuItem.publicationStatus !== MenuItemPublicationStatus.PUBLISHED) {
        throw new BadRequestException(
          `Dish "${menuItem.name}" is no longer on the public menu`,
        );
      }

      if (menuItem.availabilityStatus !== AvailabilityStatus.AVAILABLE) {
        throw new BadRequestException(
          `Dish "${menuItem.name}" is currently sold out / unavailable`,
        );
      }

      const itemSubtotal = Number((menuItem.price * requestedItem.quantity).toFixed(2));
      subtotal += itemSubtotal;

      validatedItems.push({
        menuItemId: menuItem._id.toString(),
        name: menuItem.name,
        unitPrice: menuItem.price,
        quantity: requestedItem.quantity,
        subtotal: itemSubtotal,
        specialInstructions: requestedItem.specialInstructions,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const taxRate = 0.05; // 5% tax
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const grandTotal = Number((subtotal + taxAmount).toFixed(2));

    return {
      valid: true,
      canSubmitInPhase6: true,
      message:
        'Cart successfully verified against AR-DINE server prices and live inventory. Final order submission and payment processing will be finalized in Phase 6.',
      subtotal,
      taxRate,
      taxAmount,
      grandTotal,
      items: validatedItems,
    };
  }

  /**
   * Staff/Admin closes an active dining session upon customer checkout or table clearing.
   */
  async closeSession(restaurantId: string, sessionId: string): Promise<{ message: string }> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const sId = TenantHelper.toObjectId(sessionId);

    const session = await this.sessionModel.findById(sId);
    if (!session) {
      throw new NotFoundException('Dining session not found');
    }

    TenantHelper.assertTenantMatch(session.restaurantId, rId, 'DiningSession');

    session.status = SessionStatus.COMPLETED;
    session.closedAt = new Date();
    await session.save();

    // Release table back to AVAILABLE
    const table = await this.tableModel.findById(session.tableId);
    if (table && table.operationalStatus === TableStatus.OCCUPIED) {
      table.operationalStatus = TableStatus.AVAILABLE;
      await table.save();
    }

    return { message: 'Dining session completed and table cleared successfully' };
  }

  /**
   * Staff/Admin lists currently active sessions for the restaurant.
   */
  async listActiveSessions(restaurantId: string): Promise<SessionResponseDto[]> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const now = new Date();

    const [sessions, restaurant] = await Promise.all([
      this.sessionModel
        .find({
          restaurantId: rId,
          status: SessionStatus.ACTIVE,
          expiresAt: { $gt: now },
        })
        .populate<{ tableId: RestaurantTableDocument }>('tableId')
        .sort({ createdAt: -1 }),
      this.restaurantModel.findById(rId),
    ]);

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return sessions.map((s: any) => {
      const tableDoc = s.tableId;
      const tableNumber = tableDoc?.tableNumber || 'Unknown';
      const tableIdStr = tableDoc?._id ? tableDoc._id.toString() : s.tableId.toString();
      return {
        id: s._id.toString(),
        sessionToken: s.sessionToken,
        restaurantId: s.restaurantId.toString(),
        tableId: tableIdStr,
        tableNumber,
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        status: s.status,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      };
    });
  }
}
