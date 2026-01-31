import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ModuleUnitService } from './module-unit.service';
import { CreateModuleUnitDto } from './dto/create-module-unit.dto';
import { UpdateModuleUnitDto } from './dto/update-module-unit.dto';
import { CreateModuleUnitMinimalDto } from './dto/create-module-unit-minimal.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { ModuleAccess } from '../../auth/decorators/module-access.decorator';
import { assertHasAccess } from '../../helpers/permissions.helper';
import type { AuthUser } from '../../types/auth-user.type';

// This controller serves both `/module-unit` CRUD endpoints and the module-scoped create route `/module/:moduleId/units`.
@Controller()
export class ModuleUnitController {
  constructor(private readonly moduleUnitService: ModuleUnitService) {}

  // Module-scoped creation aligned with frontend call: POST /module/:moduleId/units
  @Post('module/:moduleId/units')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId' })
  createForModule(
    @Param('moduleId') moduleId: string,
    @Body() createModuleUnitDto: CreateModuleUnitMinimalDto,
    @Req() req: Request,
  ) {
    assertHasAccess('modules.manageContent', req.user as AuthUser);
    return this.moduleUnitService.createForModule(
      +moduleId,
      createModuleUnitDto,
    );
  }

  @Post('module-unit')
  create(@Body() createModuleUnitDto: CreateModuleUnitDto) {
    return this.moduleUnitService.create(createModuleUnitDto);
  }

  @Get('module-unit')
  findAll() {
    return this.moduleUnitService.findAll();
  }

  @Get('module/:moduleId/units')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId', allowStudentRead: true })
  findByModule(@Param('moduleId') moduleId: string) {
    return this.moduleUnitService.findByModule(+moduleId);
  }

  @Get('module-unit/:id')
  findOne(@Param('id') id: string) {
    return this.moduleUnitService.findOne(+id);
  }

  @Patch('module-unit/:id')
  update(
    @Param('id') id: string,
    @Body() updateModuleUnitDto: UpdateModuleUnitDto,
  ) {
    return this.moduleUnitService.update(+id, updateModuleUnitDto);
  }

  @Delete('module-unit/:id')
  remove(@Param('id') id: string) {
    return this.moduleUnitService.remove(+id);
  }
}
