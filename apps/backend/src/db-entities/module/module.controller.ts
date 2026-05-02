// HTTP controller for module CRUD. All routes are protected by session auth and capability-based
// authorisation. The deletion-impact endpoint allows the UI to display a confirmation prompt
// before the instructor proceeds with archiving or purging a module.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ModuleService } from './module.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { Authorize } from '../../auth/decorators/authorize.decorator';
import type { AuthUser } from '../../types/auth-user.type';
import { features } from '@scholarxp/permissions';

@Controller('module')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post()
  @Authorize({ capability: features.modules.create, scope: 'global' })
  create(@Body() createModuleDto: CreateModuleDto, @Req() req: Request) {
    return this.moduleService.create(createModuleDto, req.user as AuthUser);
  }

  @Get()
  @Authorize({ capability: features.navigation.modules, scope: 'global' })
  findAll(@Req() req: Request) {
    // Return only modules within the caller's scope.
    return this.moduleService.findAll(req.user as AuthUser);
  }

  @Get(':id/deletion-impact')
  @Authorize({ capability: features.modules.delete, scope: 'module' })
  getDeletionImpact(@Param('id', ParseIntPipe) id: number) {
    return this.moduleService.getDeletionImpact(id);
  }

  @Get(':id')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.moduleService.findOne(id, req.user as AuthUser);
  }

  @Patch(':id')
  @Authorize({ capability: features.modules.settings, scope: 'module' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuleDto: UpdateModuleDto,
    @Req() req: Request,
  ) {
    return this.moduleService.update(id, updateModuleDto, req.user as AuthUser);
  }

  @Delete(':id')
  @Authorize({
    capability: features.modules.delete,
    scope: 'module',
    allowArchived: true,
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.moduleService.remove(id, req.user as AuthUser);
  }
}
