import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleUnitStatus, Prisma } from '@prisma/client';
import { DEFAULT_QUESTION_TYPE } from '@scholarxp/question-type-dtos';
import type { QuestionData } from '@scholarxp/question-type-dtos';
import {
  getModuleUnitGroupName,
  MODULE_UNIT_GROUP_START_ORDER,
  type QuestionAttemptResult,
  type QuestionSource,
} from '@scholarxp/api-contracts';
import { CreateModuleUnitDto } from './dto/create-module-unit.dto';
import { UpdateModuleUnitDto } from './dto/update-module-unit.dto';
import { CreateModuleUnitMinimalDto } from './dto/create-module-unit-minimal.dto';
import { ModuleUnitEditorDto } from './dto/module-unit-editor.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModuleUnitService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleUnitDto: CreateModuleUnitDto) {
    return this.prisma.moduleUnit.create({ data: createModuleUnitDto });
  }

  findAll() {
    return this.prisma.moduleUnit.findMany();
  }

  async findByModule(moduleId: number, studentId?: number) {
    const units = (await this.prisma.moduleUnit.findMany({
      where: { moduleId },
      orderBy: { sortOrder: 'asc' },
      include: {
        questionGroups: {
          where: { isArchived: false },
          orderBy: { sortOrder: 'asc' },
        },
        // Include question metadata so cards can render grouped question previews.
        questionUnits: {
          where: { isArchived: false },
          select: { id: true, title: true, questionGroupId: true },
        },
        // Include only the requesting student's progress record so completion-medal state comes from one source of truth.
        userProgress: {
          where: {
            // For non-student callers we force an impossible id to avoid loading unrelated student progress.
            studentId: studentId ?? -1,
          },
          select: { isCompleted: true },
        },
      },
    })) as Prisma.ModuleUnitGetPayload<{
      include: {
        questionGroups: true;
        questionUnits: {
          select: { id: true; title: true; questionGroupId: true };
        };
        userProgress: {
          select: { isCompleted: true };
        };
      };
    }>[];

    const latestAttemptByQuestionKey: Map<string, QuestionAttemptResult> =
      studentId !== undefined
        ? await this.getLatestAttemptByQuestionKey(
            units.map((unit) => unit.id),
            studentId,
          )
        : new Map<string, QuestionAttemptResult>();

    return units.map((unit) => {
      const isCompleted = unit.userProgress.some(
        (progress) => progress.isCompleted,
      );

      return {
        id: unit.id,
        moduleId: unit.moduleId,
        variantContext: unit.variantContext,
        title: unit.title,
        // Derive count from active questions at read time to avoid stale denormalized values.
        questionCount: unit.questionUnits.length,
        // This flips true exactly when module_unit_user_progress.isCompleted is true for the student.
        isCompleted,
        status: unit.status,
        sortOrder: unit.sortOrder,
        createdAt: unit.createdAt,
        questionGroups: unit.questionGroups.map((group) => ({
          ...group,
          questions: unit.questionUnits
            .filter((question) => question.questionGroupId === group.id)
            .map((question) => {
              const questionAttemptKey = this.buildQuestionAttemptKey(
                unit.id,
                question.id,
              );
              // Prisma payload inference can degrade through nested map callbacks; narrow explicitly for stable API output.

              const lastAttemptResult = latestAttemptByQuestionKey.has(
                questionAttemptKey,
              )
                ? (latestAttemptByQuestionKey.get(
                    questionAttemptKey,
                  ) as QuestionAttemptResult)
                : null;
              return {
                id: question.id,
                title: question.title,

                lastAttemptResult,
              };
            }),
        })),
      };
    });
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  // Read payload tailored for the module-unit editor; now includes groups, questions, and variants.
  async findEditorPayload(id: number): Promise<ModuleUnitEditorDto> {
    const record = (await this.prisma.moduleUnit.findUnique({
      where: { id },
      include: {
        questionGroups: {
          where: { isArchived: false },
          orderBy: { sortOrder: 'asc' },
        },
        questionUnits: {
          where: { isArchived: false },
          include: {
            contents: {
              where: { isArchived: false },
            },
            variants: {
              where: {
                content: {
                  isArchived: false,
                },
              },
              include: { content: true },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    })) as Prisma.ModuleUnitGetPayload<{
      include: {
        questionGroups: true;
        questionUnits: {
          include: {
            contents: true;
            variants: { include: { content: true } };
          };
        };
      };
    }> | null;
    if (!record) {
      throw new NotFoundException(`ModuleUnit ${id} not found`);
    }
    const groupedQuestions = record.questionGroups.map((group) => {
      const questions = record.questionUnits
        .filter((q) => q.questionGroupId === group.id)
        .map((q) => {
          const coreContent = q.contents.find((c) => c.isCore);
          return {
            id: q.id,
            questionGroupId: q.questionGroupId,
            title: q.title,
            type: coreContent?.type ?? DEFAULT_QUESTION_TYPE,
            coreContent: coreContent
              ? {
                  id: coreContent.id,
                  questionUnitId: coreContent.questionUnitId,
                  questionStem: coreContent.questionStem,
                  questionData:
                    coreContent.questionData as unknown as QuestionData,
                  type: coreContent.type,
                  hint: coreContent.hint,
                  difficultyScore: coreContent.difficultyScore,
                  source: coreContent.source as QuestionSource,
                  // Archive flag keeps the editor aligned with backend status simplification.
                  isArchived: coreContent.isArchived,
                }
              : null,
            variants: q.variants.map((v) => ({
              id: v.id,
              variantLabel: v.variantLabel,
              content: {
                id: v.content.id,
                questionUnitId: v.content.questionUnitId,
                questionStem: v.content.questionStem,
                questionData: v.content.questionData as unknown as QuestionData,
                type: v.content.type,
                hint: v.content.hint,
                difficultyScore: v.content.difficultyScore,
                source: v.content.source as QuestionSource,
                isArchived: v.content.isArchived,
              },
            })),
          };
        });

      return {
        id: group.id,
        moduleUnitId: group.moduleUnitId,
        name: group.name,
        sortOrder: group.sortOrder,
        questions,
      };
    });

    return {
      id: record.id,
      moduleId: record.moduleId,
      title: record.title,
      variantContext: record.variantContext,
      questionGroups: groupedQuestions,
    };
  }

  async update(id: number, updateModuleUnitDto: UpdateModuleUnitDto) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnit.update({
      where: { id },
      data: updateModuleUnitDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnit.delete({ where: { id } });
  }

  // Create a module unit scoped to a module with sane defaults and a starter question group.
  // Orchestrates sort order calculation and unit+group creation.
  async createForModule(moduleId: number, dto: CreateModuleUnitMinimalDto) {
    const nextSortOrder = await this.getNextSortOrder(moduleId);
    return this.createUnitWithDefaultGroup(moduleId, dto.title, nextSortOrder);
  }

  // Calculate the next available sort order for units within a module.
  // Returns 1 if no units exist, otherwise max + 1.
  private async getNextSortOrder(moduleId: number): Promise<number> {
    const result = await this.prisma.moduleUnit.aggregate({
      where: { moduleId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? 0) + 1;
  }

  // Create a module unit and its starter question group in a transaction.
  // Returns the unit with the embedded question group for consistency with API shape.
  private async createUnitWithDefaultGroup(
    moduleId: number,
    title: string,
    sortOrder: number,
  ) {
    const { unit, starterGroup } = await this.prisma.$transaction(
      async (tx) => {
        const createdUnit = await tx.moduleUnit.create({
          data: {
            moduleId,
            variantContext: '',
            title,
            questionCount: 0,
            status: ModuleUnitStatus.draft,
            sortOrder,
          },
        });

        const createdGroup = await tx.moduleUnitQuestionGroup.create({
          data: {
            moduleUnitId: createdUnit.id,
            // Seed with Group 1 so untouched titles render cleanly in authoring/student views.
            name: getModuleUnitGroupName(MODULE_UNIT_GROUP_START_ORDER),
            sortOrder: MODULE_UNIT_GROUP_START_ORDER,
          },
        });

        return { unit: createdUnit, starterGroup: createdGroup };
      },
    );

    return {
      ...unit,
      questionGroups: [
        {
          id: starterGroup.id,
          moduleUnitId: unit.id,
          name: starterGroup.name,
          sortOrder: starterGroup.sortOrder,
        },
      ],
    };
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleUnit.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`ModuleUnit not found`);
    }
    return record;
  }

  private async getLatestAttemptByQuestionKey(
    moduleUnitIds: number[],
    studentId: number,
  ): Promise<Map<string, QuestionAttemptResult>> {
    if (moduleUnitIds.length === 0) {
      return new Map();
    }

    const latestAttempts = await this.prisma.questionAttempt.findMany({
      where: {
        moduleUnitId: { in: moduleUnitIds },
        studentId,
      },
      orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
      select: {
        moduleUnitId: true,
        questionId: true,
        isCorrect: true,
      },
    });

    const latestAttemptByQuestionKey = new Map<string, QuestionAttemptResult>();
    for (const latestAttempt of latestAttempts) {
      const key = this.buildQuestionAttemptKey(
        latestAttempt.moduleUnitId!,
        latestAttempt.questionId,
      );
      if (latestAttemptByQuestionKey.has(key)) {
        continue;
      }
      latestAttemptByQuestionKey.set(
        key,
        latestAttempt.isCorrect === true ? 'correct' : 'incorrect',
      );
    }

    return latestAttemptByQuestionKey;
  }

  private buildQuestionAttemptKey(
    moduleUnitId: number,
    questionId: number,
  ): string {
    return `${moduleUnitId}:${questionId}`;
  }
}
