import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('institution')
@UseGuards(SessionAuthGuard, RolesGuard)
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Post()
  create(@Body() createInstitutionDto: CreateInstitutionDto) {
    return this.institutionService.create(createInstitutionDto);
  }

  @Get()
  findAll() {
    return this.institutionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutionService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
  ) {
    return this.institutionService.update(+id, updateInstitutionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.institutionService.remove(+id);
  }
}
