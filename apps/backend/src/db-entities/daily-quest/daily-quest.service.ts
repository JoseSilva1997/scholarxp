import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDailyQuestDto } from './dto/create-daily-quest.dto';
import { UpdateDailyQuestDto } from './dto/update-daily-quest.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DailyQuestService {
  constructor(private readonly prisma: PrismaService) {}

  create(createDailyQuestDto: CreateDailyQuestDto) {
    return this.prisma.dailyQuest.create({ data: createDailyQuestDto });
  }

  findAll() {
    return this.prisma.dailyQuest.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateDailyQuestDto: UpdateDailyQuestDto) {
    await this.getOrThrow(id);
    return this.prisma.dailyQuest.update({
      where: { id },
      data: updateDailyQuestDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.dailyQuest.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.dailyQuest.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`DailyQuest ${id} not found`);
    }
    return record;
  }
}
