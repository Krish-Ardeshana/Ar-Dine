import { BadRequestException } from '@nestjs/common';
import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';

/**
 * Multi-Tenant Query & Boundary Utility
 * Ensures that every data access operation explicitly enforces tenant filtering
 * and validates tenant identity from trusted authenticated context.
 */
export class TenantHelper {
  /**
   * Safely converts any string or ObjectId representation to a canonical Types.ObjectId.
   */
  static toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) {
      return id;
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid tenant/entity identifier format: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  /**
   * Constructs a strictly tenant-scoped MongoDB filter query.
   * Guarantees that restaurantId is unconditionally bound to the query filter.
   */
  static scopeQuery<T extends { restaurantId: Types.ObjectId }>(
    restaurantId: string | Types.ObjectId,
    filter: QueryFilter<T> = {},
  ): QueryFilter<T> & { restaurantId: Types.ObjectId } {
    const canonicalTenantId = this.toObjectId(restaurantId);
    return {
      ...(filter as Record<string, unknown>),
      restaurantId: canonicalTenantId,
    } as QueryFilter<T> & { restaurantId: Types.ObjectId };
  }

  /**
   * Asserts that a document or entity belongs to the verified tenant.
   * Prevents cross-tenant data leakage if an entity was fetched across boundaries.
   */
  static assertTenantMatch(
    entityTenantId: string | Types.ObjectId,
    expectedTenantId: string | Types.ObjectId,
    resourceName = 'Resource',
  ): void {
    const entityId = this.toObjectId(entityTenantId);
    const expectedId = this.toObjectId(expectedTenantId);

    if (!entityId.equals(expectedId)) {
      throw new BadRequestException(
        `${resourceName} does not belong to the authorized restaurant tenant`,
      );
    }
  }
}
