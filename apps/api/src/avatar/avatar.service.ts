import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAvatarDto: CreateAvatarDto) {
    return this.prisma.avatar.create({ data: createAvatarDto });
  }

  findAll() {
    return this.prisma.avatar.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateAvatarDto: UpdateAvatarDto) {
    await this.getOrThrow(id);
    return this.prisma.avatar.update({
      where: { id },
      data: updateAvatarDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.avatar.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const avatar = await this.prisma.avatar.findUnique({ where: { id } });
    if (!avatar) {
      throw new NotFoundException(`Avatar ${id} not found`);
    }
    return avatar;
  }
}
