import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateQuestionUnitDto } from './dto/create-question-unit.dto';
import { UpdateQuestionUnitDto } from './dto/update-question-unit.dto';
import { PrismaService } from '../prisma/prisma.service';

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

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.questionUnit.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.questionUnit.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`QuestionUnit ${id} not found`);
    }
    return record;
  }
}
