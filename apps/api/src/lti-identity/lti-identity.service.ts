import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLtiIdentityDto } from './dto/create-lti-identity.dto';
import { UpdateLtiIdentityDto } from './dto/update-lti-identity.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LtiIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  create(createLtiIdentityDto: CreateLtiIdentityDto) {
    return this.prisma.ltiIdentity.create({ data: createLtiIdentityDto });
  }

  findAll() {
    return this.prisma.ltiIdentity.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateLtiIdentityDto: UpdateLtiIdentityDto) {
    await this.getOrThrow(id);
    return this.prisma.ltiIdentity.update({
      where: { id },
      data: updateLtiIdentityDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.ltiIdentity.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.ltiIdentity.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`LTI identity ${id} not found`);
    }
    return record;
  }
}
