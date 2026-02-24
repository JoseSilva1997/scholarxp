import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateQuestionAttemptDto } from './dto/create-question-attempt.dto';
import { UpdateQuestionAttemptDto } from './dto/update-question-attempt.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuestionAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  create(createQuestionAttemptDto: CreateQuestionAttemptDto) {
    // Prisma JSON input expects InputJsonValue; DTO keeps unknown to force explicit boundary handling.
    const data: Prisma.QuestionAttemptUncheckedCreateInput = {
      moduleUnitId: createQuestionAttemptDto.moduleUnitId,
      studentId: createQuestionAttemptDto.studentId,
      questionId: createQuestionAttemptDto.questionId,
      contentId: createQuestionAttemptDto.contentId,
      sessionId: createQuestionAttemptDto.sessionId,
      practiceMode: createQuestionAttemptDto.practiceMode,
      isCorrect: createQuestionAttemptDto.isCorrect,
      timeTakenMs: createQuestionAttemptDto.timeTakenMs,
      hintsUsed: createQuestionAttemptDto.hintsUsed,
      studentAnswer:
        createQuestionAttemptDto.studentAnswer as Prisma.InputJsonValue,
      attemptedAt: new Date(createQuestionAttemptDto.attemptedAt),
    };
    return this.prisma.questionAttempt.create({
      data,
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
    // Build the unchecked update shape explicitly so optional FK scalars and JSON values align with Prisma's XOR types.
    const data: Prisma.QuestionAttemptUncheckedUpdateInput = {
      moduleUnitId: updateQuestionAttemptDto.moduleUnitId,
      studentId: updateQuestionAttemptDto.studentId,
      questionId: updateQuestionAttemptDto.questionId,
      contentId: updateQuestionAttemptDto.contentId,
      sessionId: updateQuestionAttemptDto.sessionId,
      practiceMode: updateQuestionAttemptDto.practiceMode,
      isCorrect: updateQuestionAttemptDto.isCorrect,
      timeTakenMs: updateQuestionAttemptDto.timeTakenMs,
      hintsUsed: updateQuestionAttemptDto.hintsUsed,
      studentAnswer:
        updateQuestionAttemptDto.studentAnswer === undefined
          ? undefined
          : (updateQuestionAttemptDto.studentAnswer as Prisma.InputJsonValue),
      attemptedAt: updateQuestionAttemptDto.attemptedAt
        ? new Date(updateQuestionAttemptDto.attemptedAt)
        : undefined,
    };
    return this.prisma.questionAttempt.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.questionAttempt.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.questionAttempt.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(`QuestionAttempt ${id} not found`);
    }
    return record;
  }
}
