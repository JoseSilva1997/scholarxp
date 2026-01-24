import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AuthIdentityService } from './auth-identity.service';
import { CreateAuthIdentityDto } from './dto/create-auth-identity.dto';
import { UpdateAuthIdentityDto } from './dto/update-auth-identity.dto';

@Controller('auth-identity')
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
