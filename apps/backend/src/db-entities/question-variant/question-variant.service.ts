import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuestionVariantDto } from './dto/create-question-variant.dto';
import { UpdateQuestionVariantDto } from './dto/update-question-variant.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuestionVariantService {
  constructor(private readonly prisma: PrismaService) {}

  create(createQuestionVariantDto: CreateQuestionVariantDto) {
    return this.prisma.questionVariant.create({
      data: createQuestionVariantDto,
    });
  }

  findAll() {
    return this.prisma.questionVariant.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateQuestionVariantDto: UpdateQuestionVariantDto) {
    await this.getOrThrow(id);
    return this.prisma.questionVariant.update({
      where: { id },
      data: updateQuestionVariantDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.questionVariant.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.questionVariant.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(`QuestionVariant ${id} not found`);
    }
    return record;
  }
}
