// Covers module-level roster summary behavior so the orchestration layer can delegate without hiding regressions.
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../test/test-helpers';
import { RosterModuleAnalyticsService } from './roster-module-analytics.service';

describe('RosterModuleAnalyticsService', () => {
  let service: RosterModuleAnalyticsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RosterModuleAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RosterModuleAnalyticsService);
  });

  it('throws when the requested module does not exist', async () => {
    prisma.module.findUnique.mockResolvedValue(null);

    await expect(service.getSummary(999)).rejects.toThrow(NotFoundException);
  });
});
