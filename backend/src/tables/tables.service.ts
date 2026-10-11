import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantHelper } from '../database/multi-tenant/tenant.helper.js';
import { TenantValidationService } from '../database/multi-tenant/tenant-validation.service.js';
import {
  OperationalStatus,
  PublicationStatus,
  Restaurant,
  RestaurantDocument,
} from '../database/schemas/restaurant.schema.js';
import {
  RestaurantTable,
  RestaurantTableDocument,
  TableStatus,
} from '../database/schemas/restaurant-table.schema.js';
import { CreateTableDto } from './dto/create-table.dto.js';
import {
  PublicRestaurantSummaryDto,
  PublicTableResolutionDto,
  PublicTableSummaryDto,
} from './dto/public-table-resolution.dto.js';
import { TableQrResponseDto } from './dto/table-qr-response.dto.js';
import { TableResponseDto } from './dto/table-response.dto.js';
import { UpdateTableDto } from './dto/update-table.dto.js';
import { QrService } from './qr.service.js';

@Injectable()
export class TablesService {
  constructor(
    @InjectModel(RestaurantTable.name)
    private readonly tableModel: Model<RestaurantTableDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly tenantValidationService: TenantValidationService,
    private readonly qrService: QrService,
  ) {}

  /**
   * Helper to format table document into response DTO
   */
  private toResponseDto(table: RestaurantTableDocument): TableResponseDto {
    return {
      id: table._id.toString(),
      restaurantId: table.restaurantId.toString(),
      tableNumber: table.tableNumber,
      tableToken: table.tableToken,
      capacity: table.capacity,
      operationalStatus: table.operationalStatus,
      isArchived: table.isArchived ?? false,
      createdAt: (table as any).createdAt,
      updatedAt: (table as any).updatedAt,
    };
  }

  /**
   * Creates a new table for the authorized restaurant.
   * Generates a stable, immutable tableToken.
   */
  async createTable(restaurantId: string, dto: CreateTableDto): Promise<TableResponseDto> {
    const rId = TenantHelper.toObjectId(restaurantId);

    const restaurant = await this.restaurantModel.findById(rId);
    if (!restaurant) {
      throw new NotFoundException(`Restaurant not found: ${restaurantId}`);
    }

    const trimmedTableNumber = dto.tableNumber.trim();

    // Check duplicate tableNumber within this restaurant
    const existingTable = await this.tableModel.findOne({
      restaurantId: rId,
      tableNumber: trimmedTableNumber,
      isArchived: false,
    });
    if (existingTable) {
      throw new ConflictException(
        `Table number "${trimmedTableNumber}" already exists in this restaurant`,
      );
    }

    // Generate unique tableToken with collision avoidance
    let tableToken = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      attempts++;
      tableToken = this.qrService.generateTableToken();
      const collision = await this.tableModel.findOne({ tableToken });
      if (!collision) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      throw new ConflictException('Failed to generate a unique table token. Please try again.');
    }

    const table = new this.tableModel({
      restaurantId: rId,
      tableNumber: trimmedTableNumber,
      tableToken,
      capacity: dto.capacity ?? 4,
      operationalStatus: dto.operationalStatus ?? TableStatus.AVAILABLE,
      isArchived: false,
    });

    const saved = await table.save();
    return this.toResponseDto(saved);
  }

  /**
   * Lists all tables for an authorized restaurant.
   */
  async getTables(restaurantId: string, includeArchived = false): Promise<TableResponseDto[]> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const filter: Record<string, unknown> = { restaurantId: rId };
    if (!includeArchived) {
      filter.isArchived = false;
    }

    const tables = await this.tableModel.find(filter).sort({ tableNumber: 1 });
    return tables.map((t) => this.toResponseDto(t));
  }

  /**
   * Retrieves single table by ID with tenant verification.
   */
  async getTableById(restaurantId: string, tableId: string): Promise<TableResponseDto> {
    const table = await this.tenantValidationService.validateTableBelongsToRestaurant(
      tableId,
      restaurantId,
    );
    return this.toResponseDto(table);
  }

  /**
   * Updates table details. tableToken remains strictly immutable.
   */
  async updateTable(
    restaurantId: string,
    tableId: string,
    dto: UpdateTableDto,
  ): Promise<TableResponseDto> {
    const table = await this.tenantValidationService.validateTableBelongsToRestaurant(
      tableId,
      restaurantId,
    );

    if (dto.tableNumber !== undefined) {
      const trimmed = dto.tableNumber.trim();
      if (trimmed !== table.tableNumber) {
        const conflict = await this.tableModel.findOne({
          restaurantId: table.restaurantId,
          tableNumber: trimmed,
          _id: { $ne: table._id },
          isArchived: false,
        });
        if (conflict) {
          throw new ConflictException(
            `Table number "${trimmed}" is already assigned to another table`,
          );
        }
        table.tableNumber = trimmed;
      }
    }

    if (dto.capacity !== undefined) {
      table.capacity = dto.capacity;
    }

    if (dto.operationalStatus !== undefined) {
      table.operationalStatus = dto.operationalStatus;
    }

    if (dto.isArchived !== undefined) {
      table.isArchived = dto.isArchived;
      if (dto.isArchived) {
        table.operationalStatus = TableStatus.OUT_OF_SERVICE;
      }
    }

    const saved = await table.save();
    return this.toResponseDto(saved);
  }

  /**
   * Safely archives a table. Historical order foreign keys remain valid.
   */
  async deleteTable(restaurantId: string, tableId: string): Promise<{ message: string }> {
    const table = await this.tenantValidationService.validateTableBelongsToRestaurant(
      tableId,
      restaurantId,
    );

    table.isArchived = true;
    table.operationalStatus = TableStatus.OUT_OF_SERVICE;
    await table.save();

    return { message: `Table ${table.tableNumber} archived successfully` };
  }

  /**
   * Generates QR code response containing target URL, high-res data URL, and SVG for printing.
   */
  async getTableQr(restaurantId: string, tableId: string): Promise<TableQrResponseDto> {
    const table = await this.tenantValidationService.validateTableBelongsToRestaurant(
      tableId,
      restaurantId,
    );

    const restaurant = await this.restaurantModel.findById(table.restaurantId);
    if (!restaurant) {
      throw new NotFoundException(`Restaurant not found`);
    }

    const targetUrl = this.qrService.computeTableUrl(restaurant.slug, table.tableToken);
    const [qrDataUrl, qrSvg] = await Promise.all([
      this.qrService.generateQrDataUrl(targetUrl),
      this.qrService.generateQrSvg(targetUrl),
    ]);

    return {
      tableId: table._id.toString(),
      tableNumber: table.tableNumber,
      tableToken: table.tableToken,
      restaurantId: restaurant._id.toString(),
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name,
      targetUrl,
      qrDataUrl,
      qrSvg,
    };
  }

  /**
   * Batch generates QR codes for all active tables in a restaurant.
   */
  async getBatchTableQrs(restaurantId: string, limit = 50): Promise<TableQrResponseDto[]> {
    const rId = TenantHelper.toObjectId(restaurantId);
    const restaurant = await this.restaurantModel.findById(rId);
    if (!restaurant) {
      throw new NotFoundException(`Restaurant not found: ${restaurantId}`);
    }

    const tables = await this.tableModel
      .find({ restaurantId: rId, isArchived: false })
      .sort({ tableNumber: 1 })
      .limit(limit);

    return Promise.all(
      tables.map(async (table) => {
        const targetUrl = this.qrService.computeTableUrl(restaurant.slug, table.tableToken);
        const [qrDataUrl, qrSvg] = await Promise.all([
          this.qrService.generateQrDataUrl(targetUrl),
          this.qrService.generateQrSvg(targetUrl),
        ]);

        return {
          tableId: table._id.toString(),
          tableNumber: table.tableNumber,
          tableToken: table.tableToken,
          restaurantId: restaurant._id.toString(),
          restaurantSlug: restaurant.slug,
          restaurantName: restaurant.name,
          targetUrl,
          qrDataUrl,
          qrSvg,
        };
      }),
    );
  }

  /**
   * Public QR resolver:
   * Validates restaurant slug and immutable tableToken.
   * Returns minimal public restaurant & table context for digital menu browsing.
   */
  async resolvePublicTable(slug: string, tableToken: string): Promise<PublicTableResolutionDto> {
    if (!slug || !tableToken) {
      throw new BadRequestException('Restaurant slug and table token are required');
    }

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
      throw new NotFoundException('Invalid table QR link or table does not exist');
    }

    if (table.isArchived) {
      throw new NotFoundException('This table is no longer in service');
    }

    const targetUrl = this.qrService.computeTableUrl(restaurant.slug, table.tableToken);

    const restaurantSummary: PublicRestaurantSummaryDto = {
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      logoUrl: (restaurant as any).logoUrl,
      currency: restaurant.currency || 'USD',
      timezone: restaurant.timezone || 'UTC',
      isOperating: restaurant.operationalStatus === OperationalStatus.OPEN,
    };

    const tableSummary: PublicTableSummaryDto = {
      id: table._id.toString(),
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      operationalStatus: table.operationalStatus,
      isAvailable: table.operationalStatus !== TableStatus.OUT_OF_SERVICE,
    };

    return {
      restaurant: restaurantSummary,
      table: tableSummary,
      qrUrl: targetUrl,
    };
  }
}
