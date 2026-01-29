import { EmailVerificationToken, Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';

describe('EmailVerificationTokenService', () => {
  let service: EmailVerificationTokenService;
  let prisma: PrismaMock;
  const now = new Date('2026-01-28T10:00:00.000Z');
  const addMinutes = (date: Date, minutes: number) =>
    new Date(date.getTime() + minutes * 60_000);

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = createPrismaMock();
    // Allow either callback or array signature; tests only exercise callback path.
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (client: PrismaService) => Promise<unknown>)(prisma);
        }
        return arg as unknown;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationTokenService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmailVerificationTokenService>(
      EmailVerificationTokenService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('issues a fresh token and removes other active tokens for the user+reason', async () => {
    prisma.emailVerificationToken.create.mockResolvedValue({
      id: 1,
      userId: 7,
      token: 'token123',
      reason: 'signup',
      createdAt: now,
      consumedAt: null,
      expiresAt: addMinutes(now, 15),
      user: null,
    } as EmailVerificationToken);

    const token = await service.issueToken({ userId: 7, reason: 'signup' });

    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, reason: 'signup', consumedAt: null },
    });
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledTimes(1);
    expect(token.userId).toBe(7);
    expect(token.expiresAt.getTime()).toBe(addMinutes(now, 15).getTime());
  });

  it('reuses an existing active token when asked to avoid duplicates', async () => {
    const existing: EmailVerificationToken = {
      id: 2,
      userId: 5,
      token: '111111',
      reason: 'signup',
      createdAt: now,
      consumedAt: null,
      expiresAt: addMinutes(now, 10),
    };
    prisma.emailVerificationToken.findFirst.mockResolvedValue(existing);

    const result = await service.issueToken({
      userId: 5,
      reason: 'signup',
      reuseExisting: true,
    });

    expect(prisma.emailVerificationToken.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 5,
        reason: 'signup',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.emailVerificationToken.deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it('clamps TTL to the configured minimum', async () => {
    prisma.emailVerificationToken.create.mockResolvedValue({
      id: 3,
      userId: 9,
      token: 'token456',
      reason: 'signup',
      createdAt: now,
      consumedAt: null,
      expiresAt: addMinutes(now, 10),
      user: null,
    } as EmailVerificationToken);

    const token = await service.issueToken({
      userId: 9,
      reason: 'signup',
      ttlMinutes: 5,
    });

    expect(token.expiresAt.getTime()).toBe(addMinutes(now, 10).getTime());
  });

  it('consumes a valid token and stamps consumedAt', async () => {
    const row: EmailVerificationToken = {
      id: 10,
      userId: 20,
      token: '222222',
      reason: 'signup',
      createdAt: now,
      consumedAt: null,
      expiresAt: addMinutes(now, 15),
    };
    prisma.emailVerificationToken.findUnique.mockResolvedValue(row);
    prisma.emailVerificationToken.update.mockResolvedValue({
      ...row,
      user: null,
      consumedAt: now,
    } as EmailVerificationToken);

    const result = await service.consumeToken('222222');

    expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { token: '222222' },
      data: { consumedAt: now },
    });
    expect(result.consumedAt).toEqual(now);
  });

  it('rejects an expired token and removes it', async () => {
    const expired: EmailVerificationToken = {
      id: 11,
      userId: 30,
      token: '333333',
      reason: 'signup',
      createdAt: addMinutes(now, -20),
      consumedAt: null,
      expiresAt: addMinutes(now, -1),
    };
    prisma.emailVerificationToken.findUnique.mockResolvedValue(expired);

    await expect(service.consumeToken('333333')).rejects.toThrow(
      'Invalid or expired verification code.',
    );
    expect(prisma.emailVerificationToken.delete).toHaveBeenCalledWith({
      where: { token: '333333' },
    });
  });

  it('prunes expired tokens and returns the count', async () => {
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({
      count: 4,
    } as Awaited<ReturnType<typeof prisma.emailVerificationToken.deleteMany>>);

    const deleted = await service.pruneExpired();

    expect(deleted).toBe(4);
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    });
  });
});
