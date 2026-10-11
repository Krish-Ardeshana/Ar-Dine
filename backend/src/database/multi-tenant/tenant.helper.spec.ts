import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TenantHelper } from './tenant.helper.js';

describe('TenantHelper', () => {
  const restaurantAId = new Types.ObjectId();
  const restaurantBId = new Types.ObjectId();

  describe('toObjectId', () => {
    it('should return existing Types.ObjectId instance', () => {
      const objId = new Types.ObjectId();
      expect(TenantHelper.toObjectId(objId)).toBe(objId);
    });

    it('should parse valid hex string into Types.ObjectId', () => {
      const hex = '507f1f77bcf86cd799439011';
      const objId = TenantHelper.toObjectId(hex);
      expect(objId).toBeInstanceOf(Types.ObjectId);
      expect(objId.toHexString()).toBe(hex);
    });

    it('should throw BadRequestException on invalid ObjectId string', () => {
      expect(() => TenantHelper.toObjectId('invalid-id')).toThrow(BadRequestException);
    });
  });

  describe('scopeQuery', () => {
    it('should inject canonical restaurantId into empty filter', () => {
      const query = TenantHelper.scopeQuery(restaurantAId);
      expect(query.restaurantId).toEqual(restaurantAId);
    });

    it('should preserve existing query filters while strictly enforcing restaurantId', () => {
      const query = TenantHelper.scopeQuery(restaurantAId, { status: 'ACTIVE' });
      expect(query.status).toBe('ACTIVE');
      expect(query.restaurantId).toEqual(restaurantAId);
    });
  });

  describe('assertTenantMatch', () => {
    it('should pass without error when tenant IDs match', () => {
      expect(() =>
        TenantHelper.assertTenantMatch(restaurantAId, restaurantAId, 'Category'),
      ).not.toThrow();
    });

    it('should throw BadRequestException when tenant IDs do not match (cross-tenant pollution)', () => {
      expect(() =>
        TenantHelper.assertTenantMatch(restaurantAId, restaurantBId, 'MenuItem'),
      ).toThrow(BadRequestException);
    });
  });
});
