// Repository-pattern service for auth identity records. Consumed by AuthService to look up
// and create OAuth/local credentials without exposing direct Prisma access to the auth layer.
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAuthIdentityDto } from './dto/create-auth-identity.dto';
import { UpdateAuthIdentityDto } from './dto/update-auth-identity.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  // Persists a new provider credential for a user. Callers should ensure the userId exists beforehand.
  create(createAuthIdentityDto: CreateAuthIdentityDto) {
    return this.prisma.authIdentity.create({ data: createAuthIdentityDto });
  }

  findAll() {
    return this.prisma.authIdentity.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  // Validates the record exists before updating to surface 404 errors before Prisma touches the DB.
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

  // Guard clause used by update/remove to convert a missing record into an HTTP 404 before any mutation.
  private async getOrThrow(id: number) {
    const record = await this.prisma.authIdentity.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Auth identity ${id} not found`);
    }
    return record;
  }
}
