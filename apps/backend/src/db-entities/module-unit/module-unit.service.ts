import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleUnitStatus, Prisma } from '@prisma/client';
import { DEFAULT_QUESTION_TYPE } from '@scholarxp/question-type-dtos';
import type { QuestionData } from '@scholarxp/question-type-dtos';
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

  findByModule(moduleId: number) {
    return this.prisma.moduleUnit.findMany({
      where: { moduleId },
      orderBy: { sortOrder: 'asc' },
      include: {
        questionGroups: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  // Read payload tailored for the module-unit editor; now includes groups, questions, and variants.
  async findEditorPayload(id: number): Promise<ModuleUnitEditorDto> {
    const record = await this.prisma.moduleUnit.findUnique({
      where: { id },
      include: {
        questionGroups: {
          orderBy: { sortOrder: 'asc' },
        },
        questionUnits: {
          include: {
            contents: true,
            variants: {
              include: { content: true },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    }) as Prisma.ModuleUnitGetPayload<{
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
                  questionData: coreContent.questionData as unknown as QuestionData,
                  type: coreContent.type,
                  hint: coreContent.hint,
                  difficultyScore: coreContent.difficultyScore,
                  source: coreContent.source,
                  status: coreContent.status,
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
                source: v.content.source,
                status: v.content.status,
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

  // Atomically create a module unit and its default question group in a transaction.
  // Returns the unit with the embedded question group for consistency with API shape.
  private async createUnitWithDefaultGroup(
    moduleId: number,
    title: string,
    sortOrder: number,
  ) {
    const { unit, defaultGroup } = await this.prisma.$transaction(
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
            name: 'default',
            sortOrder: 1,
          },
        });

        return { unit: createdUnit, defaultGroup: createdGroup };
      },
    );

    return {
      ...unit,
      questionGroups: [
        {
          id: defaultGroup.id,
          moduleUnitId: unit.id,
          name: defaultGroup.name,
          sortOrder: defaultGroup.sortOrder,
        },
      ],
    };
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleUnit.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`ModuleUnit ${id} not found`);
    }
    return record;
  }
}
