import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AuthService } from '../../auth/auth.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { Authorize } from '../../auth/decorators/authorize.decorator';
import { features } from '@scholarxp/permissions';

@Controller('users')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Patch(':id/role')
  @Authorize({
    capability: features.users.selectOwnRole,
    scope: 'self',
    selfUserIdParam: 'id',
  })
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.usersService
      .updateRole(id, updateUserRoleDto.globalRole)
      .then(() => this.authService.getUserById(id));
  }
}
