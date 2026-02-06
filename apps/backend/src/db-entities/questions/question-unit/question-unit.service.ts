import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QuestionDataSchema } from '@scholarxp/question-type-dtos';
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
      // Use upsert to atomically find-or-create the default group and avoid
      // unique constraint races on (moduleUnitId, name) when multiple requests
      // create question units concurrently.
      const defaultGroup = await this.prisma.moduleUnitQuestionGroup.upsert({
        where: {
          moduleUnitId_name: {
            moduleUnitId: data.moduleUnitId,
            name: 'default',
          },
        },
        update: {},
        create: {
          moduleUnitId: data.moduleUnitId,
          name: 'default',
          sortOrder: 1,
        },
      });

      data.questionGroupId = defaultGroup.id;
    }

    return this.prisma.questionUnit.create({ data });
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
  ) {
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

    // Pick or create target group; we upsert a default to avoid race conditions.
    let targetGroupId = payload.questionGroupId;
    if (targetGroupId) {
      const group = await this.prisma.moduleUnitQuestionGroup.findFirst({
        where: { id: targetGroupId, moduleUnitId },
      });
      if (!group) {
        throw new NotFoundException('Question group not found');
      }
    } else {
      const defaultGroup = await this.prisma.moduleUnitQuestionGroup.upsert({
        where: {
          moduleUnitId_name: {
            moduleUnitId,
            name: 'default',
          },
        },
        update: {},
        create: {
          moduleUnitId,
          name: 'default',
          sortOrder: 1,
        },
      });
      targetGroupId = defaultGroup.id;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const questionUnit = await tx.questionUnit.create({
        data: {
          moduleUnitId,
          questionGroupId: targetGroupId,
          title: payload.title,
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
          // Guard against missing client fields so creation remains backwards compatible.
          difficultyScore: payload.difficultyScore ?? 0.5,
          source: payload.source,
          // Treat missing flag as live to preserve legacy behavior while eliminating string status values.
          isArchived: payload.isArchived ?? false,
        },
      });

      return { questionUnit, coreContent };
    });

    return result;
  }

  // Create a variant for an existing question unit with its own content and metadata.
  async createVariantWithContent(
    moduleId: number,
    moduleUnitId: number,
    questionUnitId: number,
    payload: CreateVariantWithContentDto,
  ) {
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
          // Keep variant creation resilient to older clients that do not send difficulty yet.
          difficultyScore: payload.difficultyScore ?? 0.5,
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

    return variantResult;
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
      question.moduleUnitId !== moduleUnitId ||
      question.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Question not found');
    }

    // Cascades clean up variants and contents via FK onDelete rules.
    return this.prisma.questionUnit.delete({ where: { id: questionUnitId } });
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
      variant.questionUnit?.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Variant not found');
    }

    // Deleting the variant cascades to its content because of FK onDelete rules.
    return this.prisma.questionVariant.delete({ where: { id: variantId } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.questionUnit.findUnique({ where: { id } });
    if (!record) {
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
  ) {
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

    return this.prisma.questionContent.update({
      where: { id: contentId },
      data: dto as Prisma.QuestionContentUpdateInput,
    });
  }
}
