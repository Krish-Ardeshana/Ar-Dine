import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AccountStatus, User, UserRole } from '../database/schemas/user.schema.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserId = new Types.ObjectId();
  const mockUserModelInstance = {
    _id: mockUserId,
    name: 'Rohan Sharma',
    email: 'rohan@example.com',
    accountStatus: AccountStatus.ACTIVE,
    globalRoles: [UserRole.CUSTOMER],
    memberships: [],
    passwordHash: '$2a$12$fakeHash123',
    refreshTokenHash: 'sha256hash',
    save: vi.fn().mockResolvedValue(true),
  };

  function MockUserModel(this: any, data: any) {
    Object.assign(this, mockUserModelInstance, data);
    this.save = vi.fn().mockResolvedValue(this);
  }

  MockUserModel.findOne = vi.fn();
  MockUserModel.findById = vi.fn();

  const mockJwtService = {
    signAsync: vi.fn().mockImplementation((payload: any) => {
      if (payload.type === 'refresh') return Promise.resolve('mock-refresh-token');
      return Promise.resolve('mock-access-token');
    }),
    verifyAsync: vi.fn(),
  };

  const mockPasswordService = {
    hashPassword: vi.fn().mockResolvedValue('$2a$12$hashedPassword'),
    verifyPassword: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn((key: string, def?: any) => {
      if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret-32-chars-minimum!';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret-32-chars-minimum!';
      return def;
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: MockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PasswordService,
          useValue: mockPasswordService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register customer successfully and return tokens without passwordHash', async () => {
      MockUserModel.findOne.mockResolvedValue(null);

      const result = await service.register({
        name: 'Rohan Sharma',
        email: 'Rohan@Example.com',
        password: 'Password123!',
      });

      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email: 'rohan@example.com' });
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.email).toBe('rohan@example.com');
      expect(result.user.globalRoles).toEqual([UserRole.CUSTOMER]);
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should reject registration when email already exists', async () => {
      MockUserModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(
        service.register({
          name: 'Existing User',
          email: 'rohan@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate valid credentials and issue tokens', async () => {
      const selectMock = vi.fn().mockResolvedValue({
        ...mockUserModelInstance,
        passwordHash: '$2a$12$hashedPassword',
        save: vi.fn().mockResolvedValue(true),
      });
      MockUserModel.findOne.mockReturnValue({ select: selectMock });
      mockPasswordService.verifyPassword.mockResolvedValue(true);

      const result = await service.login({
        email: 'rohan@example.com',
        password: 'Password123!',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.name).toBe('Rohan Sharma');
    });

    it('should throw generic UnauthorizedException on incorrect password', async () => {
      const selectMock = vi.fn().mockResolvedValue({
        ...mockUserModelInstance,
        passwordHash: '$2a$12$hashedPassword',
      });
      MockUserModel.findOne.mockReturnValue({ select: selectMock });
      mockPasswordService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'rohan@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw generic UnauthorizedException when email does not exist (prevents enumeration)', async () => {
      const selectMock = vi.fn().mockResolvedValue(null);
      MockUserModel.findOne.mockReturnValue({ select: selectMock });

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when user account is suspended', async () => {
      const selectMock = vi.fn().mockResolvedValue({
        ...mockUserModelInstance,
        accountStatus: AccountStatus.SUSPENDED,
        passwordHash: '$2a$12$hashedPassword',
      });
      MockUserModel.findOne.mockReturnValue({ select: selectMock });
      mockPasswordService.verifyPassword.mockResolvedValue(true);

      await expect(
        service.login({
          email: 'rohan@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token hash on server', async () => {
      const targetUser = {
        ...mockUserModelInstance,
        refreshTokenHash: 'activeHash',
        save: vi.fn().mockResolvedValue(true),
      };
      const selectMock = vi.fn().mockResolvedValue(targetUser);
      MockUserModel.findById.mockReturnValue({ select: selectMock });

      const result = await service.logout(targetUser._id);
      expect(targetUser.refreshTokenHash).toBeUndefined();
      expect(result.message).toContain('revoked');
    });
  });
});
