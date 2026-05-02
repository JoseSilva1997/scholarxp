// Basic CRUD service for question content records. Higher-level operations (scoped update,
// variant archiving) are handled by QuestionUnitService which has module/unit context.
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuestionContentDto } from './dto/create-question-content.dto';
import { UpdateQuestionContentDto } from './dto/update-question-content.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class QuestionContentService {
  constructor(private readonly prisma: PrismaService) {}

  create(createQuestionContentDto: CreateQuestionContentDto) {
    return this.prisma.questionContent.create({
      data: createQuestionContentDto,
    });
  }

  findAll() {
    return this.prisma.questionContent.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateQuestionContentDto: UpdateQuestionContentDto) {
    await this.getOrThrow(id);
    return this.prisma.questionContent.update({
      where: { id },
      data: updateQuestionContentDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.questionContent.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.questionContent.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(`QuestionContent ${id} not found`);
    }
    return record;
  }
}
