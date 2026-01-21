import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuestionUnitDto } from './dto/create-question-unit.dto';
import { UpdateQuestionUnitDto } from './dto/update-question-unit.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionUnitService {
  constructor(private readonly prisma: PrismaService) {}

  create(createQuestionUnitDto: CreateQuestionUnitDto) {
    return this.prisma.questionUnit.create({ data: createQuestionUnitDto });
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
