import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ModuleUnitService } from './module-unit.service';
import { CreateModuleUnitDto } from './dto/create-module-unit.dto';
import { UpdateModuleUnitDto } from './dto/update-module-unit.dto';

@Controller('module-unit')
export class ModuleUnitController {
  constructor(private readonly moduleUnitService: ModuleUnitService) {}

  @Post()
  create(@Body() createModuleUnitDto: CreateModuleUnitDto) {
    return this.moduleUnitService.create(createModuleUnitDto);
  }

  @Get()
  findAll() {
    return this.moduleUnitService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleUnitService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateModuleUnitDto: UpdateModuleUnitDto,
  ) {
    return this.moduleUnitService.update(+id, updateModuleUnitDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.moduleUnitService.remove(+id);
  }
}
