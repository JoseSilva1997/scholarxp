import { Injectable, NotFoundException } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({ data: createUserDto });
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: number) {
    return this.getUserOrThrow(id);
  }
  // Generic update method for any user fields
  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.getUserOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async updateRole(id: number, role: GlobalRole) {
    const existingUser = await this.getUserOrThrow(id);
    const shouldCreateAvatar =
      role === GlobalRole.student && existingUser.globalRole !== GlobalRole.student;

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: { globalRole: role },
      });

      if (shouldCreateAvatar) {
        const existingAvatar = await tx.avatar.findFirst({
          where: { userId: id },
          select: { id: true },
        });
        // Ensure every newly declared student starts with an avatar for XP tracking.
        if (!existingAvatar) {
          await tx.avatar.create({
            data: {
              userId: id,
              level: 1,
              currentExp: 0,
            },
          });
        }
      }
      return updatedUser;
    });
  }

  async remove(id: number) {
    await this.getUserOrThrow(id);
    return this.prisma.user.delete({ where: { id } });
  }

  private async getUserOrThrow(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
