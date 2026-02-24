// ModuleInviteController now protects invite CRUD behind module-level permissions.
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
import { ModuleInviteService } from './module-invite.service';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';
import { RedeemModuleInviteDto } from './dto/redeem-module-invite.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { Authorize } from '../../auth/decorators/authorize.decorator';
import type { AuthUser } from '../../types/auth-user.type';
import { features } from '@scholarxp/permissions';

// Controller exposes module-scoped invite management plus a redeem endpoint for students.
@Controller()
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class ModuleInviteController {
  constructor(private readonly moduleInviteService: ModuleInviteService) {}

  @Post('modules/:moduleId/invites')
  @Authorize({ capability: features.modules.invitations, scope: 'module' })
  create(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Body() createModuleInviteDto: CreateModuleInviteDto,
    @Req() req: Request,
  ) {
    return this.moduleInviteService.create(
      moduleId,
      createModuleInviteDto,
      req.user as AuthUser,
    );
  }

  @Get('modules/:moduleId/invites')
  @Authorize({ capability: features.modules.invitations, scope: 'module' })
  findAll(@Param('moduleId', ParseIntPipe) moduleId: number) {
    return this.moduleInviteService.findAll(moduleId);
  }

  @Patch('modules/:moduleId/invites/:id')
  @Authorize({ capability: features.modules.invitations, scope: 'module' })
  update(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuleInviteDto: UpdateModuleInviteDto,
  ) {
    return this.moduleInviteService.update(moduleId, id, updateModuleInviteDto);
  }

  @Delete('modules/:moduleId/invites/:id')
  @Authorize({ capability: features.modules.invitations, scope: 'module' })
  remove(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moduleInviteService.remove(moduleId, id);
  }

  @Post('invites/redeem')
  @Authorize({
    capability: features.modules.invitationsRedemption,
    scope: 'global',
  })
  redeem(@Body() redeemDto: RedeemModuleInviteDto, @Req() req: Request) {
    return this.moduleInviteService.redeem(redeemDto, req.user as AuthUser);
  }
}
