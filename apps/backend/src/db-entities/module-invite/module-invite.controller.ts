// ModuleInviteController now protects invite CRUD behind module-level permissions.
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
import { ModuleInviteService } from './module-invite.service';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { ModuleAccess } from '../../auth/decorators/module-access.decorator';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import type { AuthUser } from '../../types/auth-user.type';

@Controller('module-invite')
@UseGuards(SessionAuthGuard, RolesGuard)
export class ModuleInviteController {
  constructor(private readonly moduleInviteService: ModuleInviteService) {}

  @Post()
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  create(
    @Body() createModuleInviteDto: CreateModuleInviteDto,
    @Req() req: Request,
  ) {
    return this.moduleInviteService.create(
      createModuleInviteDto,
      req.user as AuthUser,
    );
  }

  @Get()
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  findAll(@Req() req: Request) {
    return this.moduleInviteService.findAll(req.user as AuthUser);
  }

  @Get(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'id' })
  @UseGuards(ModuleAccessGuard)
  findOne(@Param('id') id: string) {
    return this.moduleInviteService.findOne(+id);
  }

  @Patch(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  update(
    @Param('id') id: string,
    @Body() updateModuleInviteDto: UpdateModuleInviteDto,
    @Req() req: Request,
  ) {
    return this.moduleInviteService.update(
      +id,
      updateModuleInviteDto,
      req.user as AuthUser,
    );
  }

  @Delete(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'id' })
  @UseGuards(ModuleAccessGuard)
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.moduleInviteService.remove(+id, req.user as AuthUser);
  }
}
