import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ModuleInviteService } from './module-invite.service';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';

@Controller('module-invite')
export class ModuleInviteController {
  constructor(private readonly moduleInviteService: ModuleInviteService) {}

  @Post()
  create(@Body() createModuleInviteDto: CreateModuleInviteDto) {
    return this.moduleInviteService.create(createModuleInviteDto);
  }

  @Get()
  findAll() {
    return this.moduleInviteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleInviteService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateModuleInviteDto: UpdateModuleInviteDto) {
    return this.moduleInviteService.update(+id, updateModuleInviteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.moduleInviteService.remove(+id);
  }
}
