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
import { RedeemModuleInviteDto } from './dto/redeem-module-invite.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { ModuleAccess } from '../../auth/decorators/module-access.decorator';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import type { AuthUser } from '../../types/auth-user.type';

// Controller exposes module-scoped invite management plus a redeem endpoint for students.
@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
export class ModuleInviteController {
  constructor(private readonly moduleInviteService: ModuleInviteService) {}

  @Post('modules/:moduleId/invites')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  create(
    @Param('moduleId') moduleId: string,
    @Body() createModuleInviteDto: CreateModuleInviteDto,
    @Req() req: Request,
  ) {
    return this.moduleInviteService.create(
      Number(moduleId),
      createModuleInviteDto,
      req.user as AuthUser,
    );
  }

  @Get('modules/:moduleId/invites')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  findAll(@Param('moduleId') moduleId: string, @Req() req: Request) {
    return this.moduleInviteService.findAll(
      Number(moduleId),
      req.user as AuthUser,
    );
  }

  @Patch('modules/:moduleId/invites/:id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  update(
    @Param('moduleId') moduleId: string,
    @Param('id') id: string,
    @Body() updateModuleInviteDto: UpdateModuleInviteDto,
    @Req() req: Request,
  ) {
    return this.moduleInviteService.update(
      Number(moduleId),
      +id,
      updateModuleInviteDto,
      req.user as AuthUser,
    );
  }

  @Delete('modules/:moduleId/invites/:id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  remove(
    @Param('moduleId') moduleId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.moduleInviteService.remove(
      Number(moduleId),
      +id,
      req.user as AuthUser,
    );
  }

  @Post('invites/redeem')
  redeem(@Body() redeemDto: RedeemModuleInviteDto, @Req() req: Request) {
    return this.moduleInviteService.redeem(redeemDto, req.user as AuthUser);
  }
}
