import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
// Side-effect import loads the @types/multer namespace augmentation that adds Express.Multer.File.
import 'multer';
import { UsersService } from './users.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateTimezoneDto } from './dto/update-timezone.dto';
import { AuthService } from '../../auth/auth.service';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { Authorize } from '../../auth/decorators/authorize.decorator';
import { features } from '@scholarxp/permissions';
import {
  PROFILE_PICTURE_MAX_BYTES,
  PROFILE_PICTURE_UPLOAD_FIELD,
} from '@scholarxp/api-contracts';

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

  @Patch(':id/timezone')
  @Authorize({
    capability: features.users.updateOwnTimezone,
    scope: 'self',
    selfUserIdParam: 'id',
  })
  updateTimezone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimezoneDto,
  ) {
    return this.usersService
      .updateTimezone(id, dto.timezone)
      .then(() => this.authService.getUserById(id));
  }

  // Memory storage keeps the buffer in-process so the service can stream it straight to cloud storage
  // without touching the local filesystem; size limit is enforced by Multer before the handler runs.
  @Put(':id/profile-picture')
  @Authorize({
    capability: features.users.updateOwnProfilePicture,
    scope: 'self',
    selfUserIdParam: 'id',
  })
  @UseInterceptors(
    FileInterceptor(PROFILE_PICTURE_UPLOAD_FIELD, {
      limits: { fileSize: PROFILE_PICTURE_MAX_BYTES },
    }),
  )
  updateProfilePicture(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService
      .updateProfilePicture(id, file)
      .then(() => this.authService.getUserById(id));
  }

  @Delete(':id/profile-picture')
  @Authorize({
    capability: features.users.updateOwnProfilePicture,
    scope: 'self',
    selfUserIdParam: 'id',
  })
  removeProfilePicture(@Param('id', ParseIntPipe) id: number) {
    return this.usersService
      .removeProfilePicture(id)
      .then(() => this.authService.getUserById(id));
  }
}
