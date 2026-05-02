// Service managing the question unit lifecycle: creation with core content, variant management,
// and scope-safe deletion. Deletion strategy is hard-delete for draft units with no attempts
// and soft-archive for live units or any unit that already has student attempt history.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleUnitStatus, Prisma } from '@prisma/client';
import { QuestionDataSchema } from '@scholarxp/question-type-dtos';
import type { QuestionData } from '@scholarxp/question-type-dtos';
import {
  type CreateQuestionResponse,
  type CreateVariantResponse,
  type QuestionContentResponse,
  type QuestionSource,
  getModuleUnitGroupName,
  MODULE_UNIT_GROUP_START_ORDER,
} from '@scholarxp/api-contracts';
import { CreateQuestionUnitDto } from './dto/create-question-unit.dto';
import { UpdateQuestionUnitDto } from './dto/update-question-unit.dto';
import { CreateQuestionWithContentDto } from './dto/create-question-with-content.dto';
import { CreateVariantWithContentDto } from './dto/create-variant-with-content.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateQuestionContentDto } from '../question-content/dto/update-question-content.dto';

@Injectable()
export class QuestionUnitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createQuestionUnitDto: CreateQuestionUnitDto) {
    const data = { ...createQuestionUnitDto };

    if (!data.questionGroupId) {
      if (!data.moduleUnitId) {
        throw new BadRequestException(
          'moduleUnitId is required when questionGroupId is not provided',
        );
      }
      data.questionGroupId = await this.resolveFallbackGroupId(
        data.moduleUnitId,
      );
    }

    return this.prisma.questionUnit.create({
      data: {
        ...data,
        // Questions start active; archive is used for post-live removals.
        isArchived: false,
      },
    });
  }

  findAll() {
    return this.prisma.questionUnit.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateQuestionUnitDto: UpdateQuestionUnitDto) {
    await this.getOrThrow(id);
    return this.prisma.questionUnit.update({
      where: { id },
      data: updateQuestionUnitDto,
    });
  }

  // Legacy single-tenant delete retained for admin endpoints; scoped deletes should be preferred.
  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.questionUnit.delete({ where: { id } });
  }

  // Create a question unit and its core content in one transaction; validates module and group ownership.
  async createQuestionWithContent(
    moduleId: number,
    moduleUnitId: number,
    payload: CreateQuestionWithContentDto,
  ): Promise<CreateQuestionResponse> {
    const moduleUnit = await this.prisma.moduleUnit.findUnique({
      where: { id: moduleUnitId },
      select: { id: true, moduleId: true },
    });
    if (!moduleUnit || moduleUnit.moduleId !== moduleId) {
      throw new NotFoundException('Module unit not found');
    }

    // Validate structured question data using shared Zod schema.
    const validation = QuestionDataSchema.safeParse(payload.questionData);
    if (!validation.success) {
      throw new BadRequestException(
        `Invalid question data: ${validation.error.issues[0].message}`,
      );
    }

    // Pick or create target group while preserving existing group ordering semantics.
    let targetGroupId = payload.questionGroupId;
    if (targetGroupId) {
      const group = await this.prisma.moduleUnitQuestionGroup.findFirst({
        where: { id: targetGroupId, moduleUnitId, isArchived: false },
      });
      if (!group) {
        throw new NotFoundException('Question group not found');
      }
    } else {
      targetGroupId = await this.resolveFallbackGroupId(moduleUnitId);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const questionUnit = await tx.questionUnit.create({
        data: {
          moduleUnitId,
          questionGroupId: targetGroupId,
          title: payload.title,
          // Author-created questions are active unless explicitly archived later.
          isArchived: false,
        },
      });

      const coreContent = await tx.questionContent.create({
        data: {
          questionUnitId: questionUnit.id,
          isCore: true,
          questionStem: payload.questionStem,
          // Persist questionData as JSON; casting keeps Prisma happy while the shape is enforced at DTO level.
          questionData: payload.questionData as Prisma.InputJsonValue,
          type: payload.type,
          hint: payload.hint ?? null,
          source: payload.source,
          // Treat missing flag as live to preserve legacy behavior while eliminating string status values.
          isArchived: payload.isArchived ?? false,
        },
      });

      return { questionUnit, coreContent };
    });

    return {
      questionUnit: {
        id: result.questionUnit.id,
        moduleUnitId: result.questionUnit.moduleUnitId,
        questionGroupId: result.questionUnit.questionGroupId,
        title: result.questionUnit.title,
      },
      coreContent: {
        id: result.coreContent.id,
        questionUnitId: result.coreContent.questionUnitId,
        questionStem: result.coreContent.questionStem,
        questionData: result.coreContent
          .questionData as unknown as QuestionData,
        type: result.coreContent.type,
        hint: result.coreContent.hint,
        source: result.coreContent.source as QuestionSource,
        isArchived: result.coreContent.isArchived,
        isCore: result.coreContent.isCore,
      },
    };
  }

  // Create a variant for an existing question unit with its own content and metadata.
  async createVariantWithContent(
    moduleId: number,
    moduleUnitId: number,
    questionUnitId: number,
    payload: CreateVariantWithContentDto,
  ): Promise<CreateVariantResponse> {
    const questionUnit = await this.prisma.questionUnit.findUnique({
      where: { id: questionUnitId },
      select: {
        id: true,
        moduleUnitId: true,
        questionGroupId: true,
        moduleUnit: true,
      },
    });
    if (
      !questionUnit ||
      questionUnit.moduleUnitId !== moduleUnitId ||
      questionUnit.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Question not found');
    }

    // Validate structured question data using shared Zod schema.
    const validation = QuestionDataSchema.safeParse(payload.questionData);
    if (!validation.success) {
      throw new BadRequestException(
        `Invalid question data: ${validation.error.issues[0].message}`,
      );
    }

    // Variants reuse the same structural validation as core content but are marked non-core.
    const variantResult = await this.prisma.$transaction(async (tx) => {
      const content = await tx.questionContent.create({
        data: {
          questionUnitId,
          isCore: false,
          questionStem: payload.questionStem,
          questionData: payload.questionData as Prisma.InputJsonValue,
          type: payload.type,
          hint: payload.hint ?? null,
          source: payload.source,
          // Variants inherit the same archived flag semantics as core content.
          isArchived: payload.isArchived ?? false,
        },
      });

      const variant = await tx.questionVariant.create({
        data: {
          questionUnitId,
          contentId: content.id,
          variantLabel: payload.variantLabel,
        },
        include: {
          content: true,
        },
      });

      return { variant };
    });

    return {
      variant: {
        id: variantResult.variant.id,
        variantLabel: variantResult.variant.variantLabel,
        content: {
          id: variantResult.variant.content.id,
          questionUnitId: variantResult.variant.content.questionUnitId,
          questionStem: variantResult.variant.content.questionStem,
          questionData: variantResult.variant.content
            .questionData as unknown as QuestionData,
          type: variantResult.variant.content.type,
          hint: variantResult.variant.content.hint,
          source: variantResult.variant.content.source as QuestionSource,
          isArchived: variantResult.variant.content.isArchived,
        },
      },
    };
  }

  // Remove a question and all of its content/variants within module/unit scope.
  async removeScoped(
    moduleId: number,
    moduleUnitId: number,
    questionUnitId: number,
  ) {
    const question = await this.prisma.questionUnit.findUnique({
      where: { id: questionUnitId },
      include: {
        moduleUnit: true,
      },
    });

    if (
      !question ||
      question.isArchived ||
      question.moduleUnitId !== moduleUnitId ||
      question.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Question not found');
    }

    const hasAttempts = await this.prisma.questionAttempt.count({
      where: { questionId: questionUnitId, moduleUnitId },
    });
    const shouldArchive =
      question.moduleUnit?.status === ModuleUnitStatus.live || hasAttempts > 0;

    if (!shouldArchive) {
      // Draft units with no attempts can hard delete safely.
      return this.prisma.questionUnit.delete({ where: { id: questionUnitId } });
    }

    return this.prisma.$transaction(async (tx) => {
      // Archive both question record and its content so future set selection ignores it.
      await tx.questionContent.updateMany({
        where: { questionUnitId },
        data: { isArchived: true },
      });
      return tx.questionUnit.update({
        where: { id: questionUnitId },
        data: { isArchived: true },
      });
    });
  }

  // Resolves the question group to assign a new question to when none is specified. Reuses the
  // lowest-order existing active group, creating a default Group 1 only when the unit has none.
  // The creation is race-safe: a P2002 unique constraint collision retries by reading the concurrent winner.
  private async resolveFallbackGroupId(moduleUnitId: number): Promise<number> {
    // Reuse the first existing group for legacy units and only create Group 1 when no groups exist.
    const existingGroup = await this.prisma.moduleUnitQuestionGroup.findFirst({
      where: { moduleUnitId, isArchived: false },
      select: { id: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    if (existingGroup) {
      return existingGroup.id;
    }

    try {
      const createdGroup = await this.prisma.moduleUnitQuestionGroup.create({
        data: {
          moduleUnitId,
          name: getModuleUnitGroupName(MODULE_UNIT_GROUP_START_ORDER),
          sortOrder: MODULE_UNIT_GROUP_START_ORDER,
          // Ensure lazily created fallback group is active for assignment.
          isArchived: false,
        },
      });
      return createdGroup.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Another request created the same active fallback group concurrently; reuse it.
        const concurrentGroup =
          await this.prisma.moduleUnitQuestionGroup.findFirst({
            where: {
              moduleUnitId,
              isArchived: false,
              name: getModuleUnitGroupName(MODULE_UNIT_GROUP_START_ORDER),
            },
            select: { id: true },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          });
        if (concurrentGroup) {
          return concurrentGroup.id;
        }
      }
      throw error;
    }
  }

  // Remove a variant scoped to module/unit/question to avoid cross-tenant deletes.
  async removeVariantScoped(
    moduleId: number,
    moduleUnitId: number,
    questionUnitId: number,
    variantId: number,
  ) {
    const variant = await this.prisma.questionVariant.findUnique({
      where: { id: variantId },
      include: {
        questionUnit: {
          include: { moduleUnit: true },
        },
      },
    });

    if (
      !variant ||
      variant.questionUnitId !== questionUnitId ||
      variant.questionUnit?.moduleUnitId !== moduleUnitId ||
      variant.questionUnit?.moduleUnit?.moduleId !== moduleId ||
      variant.questionUnit?.isArchived
    ) {
      throw new NotFoundException('Variant not found');
    }

    const hasAttempts = await this.prisma.questionAttempt.count({
      where: { contentId: variant.contentId, moduleUnitId },
    });
    const shouldArchive =
      variant.questionUnit?.moduleUnit?.status === ModuleUnitStatus.live ||
      hasAttempts > 0;

    if (!shouldArchive) {
      // Draft units with no attempts can hard delete variant records.
      return this.prisma.questionVariant.delete({ where: { id: variantId } });
    }

    // Variant archive is represented by archiving its content row (variant itself has no archive flag).
    await this.prisma.questionContent.update({
      where: { id: variant.contentId },
      data: { isArchived: true },
    });
    return variant;
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.questionUnit.findUnique({ where: { id } });
    if (!record || record.isArchived) {
      throw new NotFoundException(`QuestionUnit ${id} not found`);
    }
    return record;
  }

  // Update content scoped to module/unit/question ownership to avoid cross-tenant edits.
  async updateContentScoped(
    moduleId: number,
    moduleUnitId: number,
    questionUnitId: number,
    contentId: number,
    dto: UpdateQuestionContentDto,
  ): Promise<QuestionContentResponse> {
    const content = await this.prisma.questionContent.findUnique({
      where: { id: contentId },
      include: {
        questionUnit: { include: { moduleUnit: true } },
      },
    });
    if (
      !content ||
      content.questionUnitId !== questionUnitId ||
      content.questionUnit?.moduleUnitId !== moduleUnitId ||
      content.questionUnit?.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Question content not found');
    }

    // If updating question data, validate it using shared Zod schema.
    if (dto.questionData) {
      const validation = QuestionDataSchema.safeParse(dto.questionData);
      if (!validation.success) {
        throw new BadRequestException(
          `Invalid question data: ${validation.error.issues[0].message}`,
        );
      }
    }

    const updatedContent = await this.prisma.questionContent.update({
      where: { id: contentId },
      data: dto as Prisma.QuestionContentUpdateInput,
    });

    return {
      id: updatedContent.id,
      questionUnitId: updatedContent.questionUnitId,
      questionStem: updatedContent.questionStem,
      questionData: updatedContent.questionData as unknown as QuestionData,
      type: updatedContent.type,
      hint: updatedContent.hint,
      source: updatedContent.source as QuestionSource,
      isArchived: updatedContent.isArchived,
    };
  }
}
