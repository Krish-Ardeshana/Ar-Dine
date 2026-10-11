import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { UserRole } from '../../database/schemas/user.schema.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const restaurantAId = new Types.ObjectId().toString();
  const restaurantBId = new Types.ObjectId().toString();

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(
    user: any,
    headers: Record<string, string> = {},
    params: Record<string, string> = {},
  ): ExecutionContext {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers,
          params,
          query: {},
          body: {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow public endpoints', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true); // isPublic
    const ctx = createMockContext(null);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow Super Admin unconditionally across all tenant boundaries', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce([UserRole.RESTAURANT_ADMIN]) // globalRoles
      .mockReturnValueOnce([UserRole.RESTAURANT_ADMIN]); // restaurantRoles

    const superAdminUser = {
      globalRoles: [UserRole.SUPER_ADMIN],
      memberships: [],
    };
    const ctx = createMockContext(superAdminUser, { 'x-restaurant-id': restaurantAId });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject when user lacks required global role', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce([UserRole.SUPER_ADMIN]) // globalRoles
      .mockReturnValueOnce(undefined); // restaurantRoles

    const customerUser = {
      globalRoles: [UserRole.CUSTOMER],
      memberships: [],
    };
    const ctx = createMockContext(customerUser);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should permit access when user holds required restaurant role in target restaurant', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce(undefined) // globalRoles
      .mockReturnValueOnce([UserRole.RESTAURANT_ADMIN, UserRole.KITCHEN_STAFF]); // restaurantRoles

    const staffUser = {
      globalRoles: [UserRole.CUSTOMER],
      memberships: [
        {
          restaurantId: restaurantAId,
          roles: [UserRole.KITCHEN_STAFF],
        },
      ],
    };

    const ctx = createMockContext(staffUser, { 'x-restaurant-id': restaurantAId });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should strictly reject when user holds role in Restaurant A but attempts to access Restaurant B', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce(undefined) // globalRoles
      .mockReturnValueOnce([UserRole.RESTAURANT_ADMIN]); // restaurantRoles

    const managerUser = {
      globalRoles: [UserRole.CUSTOMER],
      memberships: [
        {
          restaurantId: restaurantAId,
          roles: [UserRole.RESTAURANT_ADMIN],
        },
      ],
    };

    // Attempting to access Restaurant B with Restaurant A credentials
    const ctx = createMockContext(managerUser, { 'x-restaurant-id': restaurantBId });
    expect(() => guard.canActivate(ctx)).toThrow(
      'Access denied: You hold no authorized staff membership for this restaurant',
    );
  });

  it('should reject when restaurant context is missing but restaurant role is required', () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce(undefined) // globalRoles
      .mockReturnValueOnce([UserRole.RESTAURANT_ADMIN]); // restaurantRoles

    const managerUser = {
      globalRoles: [UserRole.CUSTOMER],
      memberships: [
        {
          restaurantId: restaurantAId,
          roles: [UserRole.RESTAURANT_ADMIN],
        },
      ],
    };

    const ctx = createMockContext(managerUser, {}); // No header or param
    expect(() => guard.canActivate(ctx)).toThrow(
      'A valid restaurant identifier (x-restaurant-id header or route param) is required',
    );
  });
});
