import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePracticeSessionDto } from './dto/create-practice-session.dto';
import { UpdatePracticeSessionDto } from './dto/update-practice-session.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PracticeSessionService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPracticeSessionDto: CreatePracticeSessionDto) {
    // Prisma expects Date objects; DTOs provide ISO strings.
    const { startTime, endTime, ...rest } = createPracticeSessionDto;
    return this.prisma.practiceSession.create({
      data: {
        ...rest,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
      },
    });
  }

  findAll() {
    return this.prisma.practiceSession.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updatePracticeSessionDto: UpdatePracticeSessionDto) {
    await this.getOrThrow(id);
    const { startTime, endTime, ...rest } = updatePracticeSessionDto;
    return this.prisma.practiceSession.update({
      where: { id },
      data: {
        ...rest,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime:
          endTime !== undefined
            ? endTime
              ? new Date(endTime)
              : null
            : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.practiceSession.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.practiceSession.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(`PracticeSession ${id} not found`);
    }
    return record;
  }
}
