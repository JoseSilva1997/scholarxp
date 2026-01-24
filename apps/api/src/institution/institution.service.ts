import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutionService {
  constructor(private readonly prisma: PrismaService) {}

  create(createInstitutionDto: CreateInstitutionDto) {
    return this.prisma.institution.create({ data: createInstitutionDto });
  }

  findAll() {
    return this.prisma.institution.findMany();
  }

  async findOne(id: number) {
    return this.getInstitutionOrThrow(id);
  }

  async update(id: number, updateInstitutionDto: UpdateInstitutionDto) {
    await this.getInstitutionOrThrow(id);
    return this.prisma.institution.update({
      where: { id },
      data: updateInstitutionDto,
    });
  }

  async remove(id: number) {
    await this.getInstitutionOrThrow(id);
    return this.prisma.institution.delete({ where: { id } });
  }

  private async getInstitutionOrThrow(id: number) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });
    if (!institution) {
      throw new NotFoundException(`Institution ${id} not found`);
    }
    return institution;
  }
}
