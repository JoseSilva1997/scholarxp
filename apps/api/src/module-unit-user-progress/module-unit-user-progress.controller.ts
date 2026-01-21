import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ModuleUnitUserProgressService } from './module-unit-user-progress.service';
import { CreateModuleUnitUserProgressDto } from './dto/create-module-unit-user-progress.dto';
import { UpdateModuleUnitUserProgressDto } from './dto/update-module-unit-user-progress.dto';

@Controller('module-unit-user-progress')
export class ModuleUnitUserProgressController {
  constructor(private readonly moduleUnitUserProgressService: ModuleUnitUserProgressService) {}

  @Post()
  create(@Body() createModuleUnitUserProgressDto: CreateModuleUnitUserProgressDto) {
    return this.moduleUnitUserProgressService.create(createModuleUnitUserProgressDto);
  }

  @Get()
  findAll() {
    return this.moduleUnitUserProgressService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleUnitUserProgressService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateModuleUnitUserProgressDto: UpdateModuleUnitUserProgressDto) {
    return this.moduleUnitUserProgressService.update(+id, updateModuleUnitUserProgressDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.moduleUnitUserProgressService.remove(+id);
  }
}
