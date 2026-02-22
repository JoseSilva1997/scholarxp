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
import { LtiIdentityService } from './lti-identity.service';
import { CreateLtiIdentityDto } from './dto/create-lti-identity.dto';
import { UpdateLtiIdentityDto } from './dto/update-lti-identity.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('lti-identity')
@UseGuards(SessionAuthGuard, RolesGuard)
export class LtiIdentityController {
  constructor(private readonly ltiIdentityService: LtiIdentityService) {}

  @Post()
  create(@Body() createLtiIdentityDto: CreateLtiIdentityDto) {
    return this.ltiIdentityService.create(createLtiIdentityDto);
  }

  @Get()
  findAll() {
    return this.ltiIdentityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ltiIdentityService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLtiIdentityDto: UpdateLtiIdentityDto,
  ) {
    return this.ltiIdentityService.update(+id, updateLtiIdentityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ltiIdentityService.remove(+id);
  }
}
