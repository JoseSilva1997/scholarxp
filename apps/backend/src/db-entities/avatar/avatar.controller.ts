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
import { AvatarService } from './avatar.service';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '@prisma/client';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('avatar')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post()
  @Roles(GlobalRole.student)
  create(@Body() createAvatarDto: CreateAvatarDto) {
    return this.avatarService.create(createAvatarDto);
  }

  @Get()
  @Roles(GlobalRole.admin, GlobalRole.institution_admin)
  findAll() {
    return this.avatarService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.avatarService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAvatarDto: UpdateAvatarDto) {
    return this.avatarService.update(+id, updateAvatarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.avatarService.remove(+id);
  }
}
