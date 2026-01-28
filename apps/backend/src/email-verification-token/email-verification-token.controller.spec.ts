import { EmailVerificationToken } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailVerificationTokenController } from './email-verification-token.controller';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../testing/test-helpers';
import { CreateEmailVerificationTokenDto } from './dto/create-email-verification-token.dto';

describe('EmailVerificationTokenController', () => {
  let controller: EmailVerificationTokenController;
  let service: EmailVerificationTokenService;

  beforeEach(async () => {
    const prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailVerificationTokenController],
      providers: [
        EmailVerificationTokenService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get<EmailVerificationTokenController>(
      EmailVerificationTokenController,
    );
    service = module.get<EmailVerificationTokenService>(
      EmailVerificationTokenService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates or reuses a token via the service', async () => {
    const dto: CreateEmailVerificationTokenDto = {
      userId: 10,
      reason: 'signup',
    };
    const token: EmailVerificationToken = {
      id: 1,
      userId: 10,
      token: '123456',
      reason: 'signup',
      createdAt: new Date(),
      expiresAt: new Date(),
      consumedAt: null,
    };
    jest.spyOn(service, 'issueToken').mockResolvedValue(token);

    const result = await controller.create(dto);

    expect(service.issueToken).toHaveBeenCalledWith({
      userId: dto.userId,
      reason: dto.reason,
      ttlMinutes: undefined,
      reuseExisting: undefined,
    });
    expect(result).toEqual(token);
  });
});
