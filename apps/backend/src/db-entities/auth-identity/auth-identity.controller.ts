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
import { AuthIdentityService } from './auth-identity.service';
import { CreateAuthIdentityDto } from './dto/create-auth-identity.dto';
import { UpdateAuthIdentityDto } from './dto/update-auth-identity.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('auth-identity')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AuthIdentityController {
  constructor(private readonly authIdentityService: AuthIdentityService) {}

  @Post()
  create(@Body() createAuthIdentityDto: CreateAuthIdentityDto) {
    return this.authIdentityService.create(createAuthIdentityDto);
  }

  @Get()
  findAll() {
    return this.authIdentityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authIdentityService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAuthIdentityDto: UpdateAuthIdentityDto,
  ) {
    return this.authIdentityService.update(+id, updateAuthIdentityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authIdentityService.remove(+id);
  }
}
