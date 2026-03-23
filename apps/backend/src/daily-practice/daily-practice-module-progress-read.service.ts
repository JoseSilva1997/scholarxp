// Role: owns read-only module-unit progress access so daily-practice selection can reason about started versus completed lessons cleanly.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ModuleUnitProgressRecord,
  PrismaClientLike,
} from './daily-practice.types';

@Injectable()
export class DailyPracticeModuleProgressReadService {
  constructor(private readonly prisma: PrismaService) {}

  // Selector policy only needs lesson completion state, so this read stays intentionally small and module-scoped.
  listModuleUnitProgress(
    userId: number,
    moduleId: number,
    tx?: PrismaClientLike,
  ): Promise<ModuleUnitProgressRecord[]> {
    const prismaClient = tx ?? this.prisma;

    return prismaClient.moduleUnitUserProgress.findMany({
      where: {
        studentId: userId,
        moduleUnit: {
          moduleId,
        },
      },
      orderBy: [{ moduleUnitId: 'asc' }],
      select: {
        moduleUnitId: true,
        isCompleted: true,
      },
    });
  }
}
