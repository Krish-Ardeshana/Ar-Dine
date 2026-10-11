import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow public endpoints without invoking Passport strategy', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = createMockContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException when no user is resolved in handleRequest', () => {
    expect(() => guard.handleRequest(null, null, { message: 'jwt expired' })).toThrow(
      UnauthorizedException,
    );
  });

  it('should return user when user is resolved in handleRequest', () => {
    const mockUser = { id: 'usr_1', email: 'user@example.com' };
    expect(guard.handleRequest(null, mockUser, null)).toBe(mockUser);
  });
});
