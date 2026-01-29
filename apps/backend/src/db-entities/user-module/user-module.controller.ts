// UserModuleController now restricts roster actions to instructors, institution admins, or admins.
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
import { UserModuleService } from './user-module.service';
import { CreateUserModuleDto } from './dto/create-user-module.dto';
import { UpdateUserModuleDto } from './dto/update-user-module.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { ModuleAccess } from '../../auth/decorators/module-access.decorator';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';

@Controller('user-module')
@UseGuards(SessionAuthGuard, RolesGuard)
export class UserModuleController {
  constructor(private readonly userModuleService: UserModuleService) {}

  @Post()
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  create(@Body() createUserModuleDto: CreateUserModuleDto) {
    return this.userModuleService.create(createUserModuleDto);
  }

  @Get()
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ allowStudentRead: false })
  @UseGuards(ModuleAccessGuard)
  findAll(@Req() req: Request) {
    // Requires moduleId in query to scope roster reads.
    const moduleId = Number(req.query.moduleId);
    return this.userModuleService.findAll(
      Number.isFinite(moduleId) ? moduleId : undefined,
    );
  }

  @Get(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'id' })
  @UseGuards(ModuleAccessGuard)
  findOne(@Param('id') id: string) {
    return this.userModuleService.findOne(+id);
  }

  @Patch(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'moduleId' })
  @UseGuards(ModuleAccessGuard)
  update(
    @Param('id') id: string,
    @Body() updateUserModuleDto: UpdateUserModuleDto,
  ) {
    return this.userModuleService.update(+id, updateUserModuleDto);
  }

  @Delete(':id')
  @Roles(GlobalRole.teacher, GlobalRole.institution_admin, GlobalRole.admin)
  @ModuleAccess({ paramKey: 'id' })
  @UseGuards(ModuleAccessGuard)
  remove(@Param('id') id: string) {
    return this.userModuleService.remove(+id);
  }
}
