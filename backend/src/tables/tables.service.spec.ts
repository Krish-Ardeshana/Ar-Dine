import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OperationalStatus,
  PublicationStatus,
} from '../database/schemas/restaurant.schema.js';
import { TableStatus } from '../database/schemas/restaurant-table.schema.js';
import { TablesService } from './tables.service.js';

describe('TablesService', () => {
  let service: TablesService;
  let mockTableModel: any;
  let mockRestaurantModel: any;
  let mockTenantValidationService: any;
  let mockQrService: any;

  const validRestaurantId = new Types.ObjectId();
  const validTableId = new Types.ObjectId();

  beforeEach(() => {
    function MockTableInstance(this: any, data: any) {
      Object.assign(this, data);
      this._id = data._id || new Types.ObjectId();
      this.save = vi.fn().mockResolvedValue(this);
    }

    mockTableModel = MockTableInstance as any;
    mockTableModel.findOne = vi.fn();
    mockTableModel.find = vi.fn();
    mockTableModel.findById = vi.fn();

    mockRestaurantModel = {
      findById: vi.fn(),
      findOne: vi.fn(),
    };

    mockTenantValidationService = {
      validateTableBelongsToRestaurant: vi.fn(),
    };

    mockQrService = {
      generateTableToken: vi.fn().mockReturnValue('tbl_mock_stable_token_123'),
      computeTableUrl: vi.fn(
        (slug: string, token: string) => `http://localhost:3000/r/${slug}/table/${token}`,
      ),
      generateQrDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,mockQrPng'),
      generateQrSvg: vi.fn().mockResolvedValue('<svg>mockSvg</svg>'),
    };

    service = new TablesService(
      mockTableModel,
      mockRestaurantModel,
      mockTenantValidationService,
      mockQrService,
    );
  });

  describe('createTable', () => {
    it('should create table with generated immutable tableToken and default capacity', async () => {
      mockRestaurantModel.findById.mockResolvedValue({
        _id: validRestaurantId,
        name: 'The Golden Spoon',
      });
      mockTableModel.findOne.mockResolvedValue(null); // No duplicate tableNumber or token

      const result = await service.createTable(validRestaurantId.toHexString(), {
        tableNumber: 'Table 10',
        capacity: 4,
      });

      expect(result.tableNumber).toBe('Table 10');
      expect(result.tableToken).toBe('tbl_mock_stable_token_123');
      expect(result.capacity).toBe(4);
      expect(result.operationalStatus).toBe(TableStatus.AVAILABLE);
    });

    it('should reject duplicate tableNumber in the same restaurant with ConflictException', async () => {
      mockRestaurantModel.findById.mockResolvedValue({
        _id: validRestaurantId,
      });
      mockTableModel.findOne.mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tableNumber: 'Table 10',
      });

      await expect(
        service.createTable(validRestaurantId.toHexString(), {
          tableNumber: 'Table 10',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTableQr', () => {
    it('should generate stable QR code without embedding mutable dish information', async () => {
      const mockTable = {
        _id: validTableId,
        restaurantId: validRestaurantId,
        tableNumber: 'Table 5',
        tableToken: 'tbl_stable_token_5',
      };

      mockTenantValidationService.validateTableBelongsToRestaurant.mockResolvedValue(mockTable);
      mockRestaurantModel.findById.mockResolvedValue({
        _id: validRestaurantId,
        name: 'The Golden Spoon',
        slug: 'golden-spoon',
      });

      const qrResponse = await service.getTableQr(
        validRestaurantId.toHexString(),
        validTableId.toHexString(),
      );

      expect(qrResponse.targetUrl).toBe('http://localhost:3000/r/golden-spoon/table/tbl_stable_token_5');
      expect(qrResponse.qrDataUrl).toBe('data:image/png;base64,mockQrPng');
      expect(qrResponse.qrSvg).toBe('<svg>mockSvg</svg>');
      // Stable URL must not contain mutable dish names or prices
      expect(qrResponse.targetUrl).not.toContain('dish');
      expect(qrResponse.targetUrl).not.toContain('price');
    });
  });

  describe('resolvePublicTable', () => {
    it('should resolve minimal public restaurant and table context for published restaurant', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        name: 'The Golden Spoon',
        slug: 'golden-spoon',
        publicationStatus: PublicationStatus.PUBLISHED,
        operationalStatus: OperationalStatus.OPEN,
        currency: 'USD',
        timezone: 'America/New_York',
      });

      mockTableModel.findOne.mockResolvedValue({
        _id: validTableId,
        restaurantId: validRestaurantId,
        tableNumber: 'T-01',
        tableToken: 'tbl_token_01',
        capacity: 4,
        operationalStatus: TableStatus.AVAILABLE,
        isArchived: false,
      });

      const result = await service.resolvePublicTable('golden-spoon', 'tbl_token_01');

      expect(result.restaurant.name).toBe('The Golden Spoon');
      expect(result.restaurant.isOperating).toBe(true);
      expect(result.table.tableNumber).toBe('T-01');
      expect(result.table.isAvailable).toBe(true);
      // Private credentials and owner settings must not be exposed
      expect((result.restaurant as any).settings).toBeUndefined();
      expect((result.restaurant as any).password).toBeUndefined();
    });

    it('should reject table resolution if restaurant is unpublished', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        name: 'Unpublished Cafe',
        slug: 'unpub-cafe',
        publicationStatus: PublicationStatus.DRAFT,
      });

      await expect(
        service.resolvePublicTable('unpub-cafe', 'tbl_token_01'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject table resolution if table belongs to different restaurant (tenant mismatch)', async () => {
      const otherRestaurantId = new Types.ObjectId();

      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        slug: 'golden-spoon',
        publicationStatus: PublicationStatus.PUBLISHED,
      });

      mockTableModel.findOne.mockResolvedValue({
        _id: validTableId,
        restaurantId: otherRestaurantId, // Different restaurant!
        tableToken: 'tbl_other_token',
      });

      await expect(
        service.resolvePublicTable('golden-spoon', 'tbl_other_token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject table resolution if table is archived', async () => {
      mockRestaurantModel.findOne.mockResolvedValue({
        _id: validRestaurantId,
        slug: 'golden-spoon',
        publicationStatus: PublicationStatus.PUBLISHED,
      });

      mockTableModel.findOne.mockResolvedValue({
        _id: validTableId,
        restaurantId: validRestaurantId,
        tableToken: 'tbl_archived_token',
        isArchived: true,
      });

      await expect(
        service.resolvePublicTable('golden-spoon', 'tbl_archived_token'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
