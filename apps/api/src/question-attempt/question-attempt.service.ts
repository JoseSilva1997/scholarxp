import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateQuestionAttemptDto } from './dto/create-question-attempt.dto';
import { UpdateQuestionAttemptDto } from './dto/update-question-attempt.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  create(createQuestionAttemptDto: CreateQuestionAttemptDto) {
    const { attemptedAt, ...rest } = createQuestionAttemptDto;
    return this.prisma.questionAttempt.create({
      data: {
        ...rest,
        attemptedAt: new Date(attemptedAt),
      },
    });
  }

  findAll() {
    return this.prisma.questionAttempt.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateQuestionAttemptDto: UpdateQuestionAttemptDto) {
    await this.getOrThrow(id);
    const { attemptedAt, ...rest } = updateQuestionAttemptDto;
    return this.prisma.questionAttempt.update({
      where: { id },
      data: {
        ...rest,
        attemptedAt: attemptedAt ? new Date(attemptedAt) : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.questionAttempt.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.questionAttempt.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`QuestionAttempt ${id} not found`);
    }
    return record;
  }
}
