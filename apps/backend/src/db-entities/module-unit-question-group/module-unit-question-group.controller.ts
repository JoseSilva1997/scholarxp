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
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';
import { CreateModuleUnitQuestionGroupDto } from './dto/create-module-unit-question-group.dto';
import { UpdateModuleUnitQuestionGroupDto } from './dto/update-module-unit-question-group.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('module-unit-question-group')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ModuleUnitQuestionGroupController {
  constructor(
    private readonly moduleUnitQuestionGroupService: ModuleUnitQuestionGroupService,
  ) {}

  @Post()
  create(
    @Body() createModuleUnitQuestionGroupDto: CreateModuleUnitQuestionGroupDto,
  ) {
    return this.moduleUnitQuestionGroupService.create(
      createModuleUnitQuestionGroupDto,
    );
  }

  @Get()
  findAll() {
    return this.moduleUnitQuestionGroupService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleUnitQuestionGroupService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateModuleUnitQuestionGroupDto: UpdateModuleUnitQuestionGroupDto,
  ) {
    return this.moduleUnitQuestionGroupService.update(
      +id,
      updateModuleUnitQuestionGroupDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.moduleUnitQuestionGroupService.remove(+id);
  }
}
