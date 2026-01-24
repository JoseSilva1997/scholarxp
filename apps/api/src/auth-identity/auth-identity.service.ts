import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAuthIdentityDto } from './dto/create-auth-identity.dto';
import { UpdateAuthIdentityDto } from './dto/update-auth-identity.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAuthIdentityDto: CreateAuthIdentityDto) {
    return this.prisma.authIdentity.create({ data: createAuthIdentityDto });
  }

  findAll() {
    return this.prisma.authIdentity.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateAuthIdentityDto: UpdateAuthIdentityDto) {
    await this.getOrThrow(id);
    return this.prisma.authIdentity.update({
      where: { id },
      data: updateAuthIdentityDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.authIdentity.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.authIdentity.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Auth identity ${id} not found`);
    }
    return record;
  }
}
