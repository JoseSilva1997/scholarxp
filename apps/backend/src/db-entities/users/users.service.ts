import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, Prisma } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Creation uses DTO-level transformations (trim, normalize) and keeps validation rules centralized.
  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: {
          ...createUserDto,
          email: createUserDto.email ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException();
    }
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
    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  async updateRole(id: number, role: GlobalRole) {
    const existingUser = await this.getUserOrThrow(id);
    const shouldCreateAvatar =
      role === GlobalRole.student &&
      existingUser.globalRole !== GlobalRole.student;

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
