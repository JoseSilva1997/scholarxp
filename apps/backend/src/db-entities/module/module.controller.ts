// ModuleController now enforces session auth, role gating, and module-scoped access checks.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { ModuleAccess } from '../../auth/decorators/module-access.decorator';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import type { AuthUser } from '../../types/auth-user.type';

@Controller('module')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @Post()
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  create(@Body() createModuleDto: CreateModuleDto, @Req() req: Request) {
    // Record creator and enforce institution scoping where applicable.
    return this.moduleService.create(createModuleDto, req.user as AuthUser);
  }

  @Get()
  findAll(@Req() req: Request) {
    // Return only modules within the caller's scope.
    return this.moduleService.findAll(req.user as AuthUser);
  }

  @Get(':id')
  @ModuleAccess({ paramKey: 'id', allowStudentRead: true })
  @UseGuards(ModuleAccessGuard)
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.moduleService.findOne(+id, req.user as AuthUser);
  }

  @Patch(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'id' })
  @UseGuards(ModuleAccessGuard)
  update(
    @Param('id') id: string,
    @Body() updateModuleDto: UpdateModuleDto,
    @Req() req: Request,
  ) {
    return this.moduleService.update(
      +id,
      updateModuleDto,
      req.user as AuthUser,
    );
  }

  @Delete(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'id' })
  @UseGuards(ModuleAccessGuard)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.moduleService.remove(+id, req.user as AuthUser);
  }
}
