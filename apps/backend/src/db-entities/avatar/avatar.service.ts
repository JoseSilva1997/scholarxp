import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAvatarDto: CreateAvatarDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: createAvatarDto.userId },
      select: { globalRole: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${createAvatarDto.userId} not found`);
    }
    if (user.globalRole !== 'student') {
      throw new BadRequestException('Only students can have avatars');
    }

    const existing = await this.prisma.avatar.findUnique({
      where: { userId: createAvatarDto.userId },
    });
    if (existing) {
      throw new BadRequestException(
        `Avatar already exists for user ${createAvatarDto.userId}`,
      );
    }

    // Persist canonical totalExp so account progression is always derived from one source of truth.
    return this.prisma.avatar.create({
      data: {
        ...createAvatarDto,
      },
    });
  }

  findAll() {
    return this.prisma.avatar.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.avatar.delete({ where: { id } });
  }

  // Practice flows award student XP through this helper so avatar progression writes stay centralized.
  async addStudentExp(
    userId: number,
    expGained: number,
    tx?: PrismaClientLike,
  ) {
    if (expGained <= 0) {
      throw new BadRequestException(
        'Experience gain must be greater than zero.',
      );
    }

    const prismaClient = tx ?? this.prisma;
    const avatar = await prismaClient.avatar.findUnique({
      where: { userId },
      select: { id: true, totalExp: true },
    });

    if (!avatar) {
      throw new NotFoundException(`Avatar not found for user ${userId}`);
    }

    const updatedTotalExp = avatar.totalExp + expGained;

    return prismaClient.avatar.update({
      where: { id: avatar.id },
      data: {
        totalExp: {
          set: updatedTotalExp,
        },
      },
    });
  }

  private async getOrThrow(id: number) {
    const avatar = await this.prisma.avatar.findUnique({ where: { id } });
    if (!avatar) {
      throw new NotFoundException(`Avatar ${id} not found`);
    }
    return avatar;
  }
}
