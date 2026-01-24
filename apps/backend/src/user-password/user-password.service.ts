import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserPasswordDto } from './dto/create-user-password.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserPasswordService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserPasswordDto: CreateUserPasswordDto) {
    return this.prisma.userPassword.create({ data: createUserPasswordDto });
  }

  findAll() {
    return this.prisma.userPassword.findMany();
  }

  async findOne(userId: number) {
    return this.getOrThrow(userId);
  }

  async update(userId: number, updateUserPasswordDto: UpdateUserPasswordDto) {
    await this.getOrThrow(userId);
    return this.prisma.userPassword.update({
      where: { userId },
      data: updateUserPasswordDto,
    });
  }

  async remove(userId: number) {
    await this.getOrThrow(userId);
    return this.prisma.userPassword.delete({ where: { userId } });
  }

  private async getOrThrow(userId: number) {
    const record = await this.prisma.userPassword.findUnique({
      where: { userId },
    });
    if (!record) {
      throw new NotFoundException(`UserPassword ${userId} not found`);
    }
    return record;
  }
}
