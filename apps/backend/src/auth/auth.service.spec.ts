import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { AuthProvider, GlobalRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../testing/test-helpers';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let bcryptMock: { hash: jest.Mock; compare: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    bcryptMock = bcrypt as unknown as { hash: jest.Mock; compare: jest.Mock };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerByEmail', () => {
    it('creates user, password, and auth identity with normalized email', async () => {
      const dto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'Jane.Doe@Example.com',
        password: 'password123',
      };
      const normalizedEmail = 'jane.doe@example.com';
      const createdAt = new Date('2026-01-01T00:00:00Z');
      const updatedAt = new Date('2026-01-02T00:00:00Z');

      const createdUser = {
        id: 1,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: normalizedEmail,
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.pending,
        isVerified: false,
        createdAt,
      };

      prisma.user.findUnique.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('hashed-password');

      const txMock = {
        user: {
          create: jest.fn().mockResolvedValue(createdUser),
        },
        userPassword: {
          create: jest.fn().mockResolvedValue({
            userId: createdUser.id,
            passwordHash: 'hashed-password',
            updatedAt,
          }),
        },
        authIdentity: {
          create: jest.fn().mockResolvedValue({
            id: 10,
            userId: createdUser.id,
            provider: AuthProvider.local,
            providerUserId: normalizedEmail,
            email: normalizedEmail,
            createdAt,
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      const result = await service.registerByEmail(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizedEmail },
      });
      expect(txMock.user.create).toHaveBeenCalledWith({
        data: {
          email: normalizedEmail,
          firstName: dto.firstName,
          lastName: dto.lastName,
          globalRole: GlobalRole.pending,
        },
      });
      expect(txMock.userPassword.create).toHaveBeenCalledWith({
        data: {
          userId: createdUser.id,
          passwordHash: 'hashed-password',
        },
      });
      expect(txMock.authIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: createdUser.id,
          provider: AuthProvider.local,
          providerUserId: normalizedEmail,
          email: normalizedEmail,
        },
      });
      expect(result).toEqual({
        id: createdUser.id,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        email: createdUser.email,
        profilePictureUrl: createdUser.profilePictureUrl,
        globalRole: createdUser.globalRole,
        isVerified: createdUser.isVerified,
        avatar: null,
      });
    });

    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 5,
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.pending,
        isVerified: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      await expect(
        service.registerByEmail({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'existing@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns user when credentials are valid', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      const updatedAt = new Date('2026-01-02T00:00:00Z');
      const user = {
        id: 7,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.student,
        isVerified: true,
        createdAt,
      };
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.userPassword.findUnique.mockResolvedValue({
        userId: user.id,
        passwordHash: 'hash',
        updatedAt,
      });
      bcryptMock.compare.mockResolvedValue(true);
      prisma.avatar.findUnique.mockResolvedValue(null);

      const result = await service.login({
        email: 'jane@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        globalRole: user.globalRole,
        isVerified: user.isVerified,
        avatar: null,
      });
    });

    it('includes avatar when student has one', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      const updatedAt = new Date('2026-01-02T00:00:00Z');
      const user = {
        id: 7,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.student,
        isVerified: true,
        createdAt,
      };
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.userPassword.findUnique.mockResolvedValue({
        userId: user.id,
        passwordHash: 'hash',
        updatedAt,
      });
      bcryptMock.compare.mockResolvedValue(true);
      prisma.avatar.findUnique.mockResolvedValue({
        id: 99,
        userId: user.id,
        level: 2,
        currentExp: 50,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      });

      const result = await service.login({
        email: 'jane@example.com',
        password: 'password123',
      });

      expect(result.avatar).toEqual({
        id: 99,
        userId: user.id,
        level: 2,
        currentExp: 50,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      });
    });

    it('throws UnauthorizedException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@example.com', password: 'pass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password record is missing', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 9,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.student,
        isVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      prisma.userPassword.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'jane@example.com', password: 'pass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      const updatedAt = new Date('2026-01-02T00:00:00Z');
      prisma.user.findUnique.mockResolvedValue({
        id: 9,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.student,
        isVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      prisma.userPassword.findUnique.mockResolvedValue({
        userId: 9,
        passwordHash: 'hash',
        updatedAt,
      });
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'jane@example.com', password: 'badpass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('getUserById', () => {
    it('returns user when found', async () => {
      const user = {
        id: 11,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.student,
        isVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserById(user.id);

      expect(result).toEqual({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        globalRole: user.globalRole,
        isVerified: user.isVerified,
        avatar: null,
      });
    });

    it('includes avatar when student has one', async () => {
      const user = {
        id: 11,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.student,
        isVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.avatar.findUnique.mockResolvedValue({
        id: 77,
        userId: user.id,
        level: 3,
        currentExp: 120,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      });

      const result = await service.getUserById(user.id);

      expect(result.avatar).toEqual({
        id: 77,
        userId: user.id,
        level: 3,
        currentExp: 120,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      });
    });

    it('returns null avatar when not student', async () => {
      const user = {
        id: 11,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        profilePictureUrl: 'default-profile-pic.png',
        globalRole: GlobalRole.instructor,
        isVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.avatar.findUnique.mockResolvedValue({
        id: 77,
        userId: user.id,
        level: 3,
        currentExp: 120,
        createdAt: new Date('2026-01-03T00:00:00Z'),
      });

      const result = await service.getUserById(user.id);

      expect(result.avatar).toBeNull();
    });

    it('throws UnauthorizedException when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById(123)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
