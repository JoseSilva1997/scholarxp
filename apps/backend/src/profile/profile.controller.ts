// Thin profile controller: delegates aggregation to role-specific services, guards enforce auth + capability.
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { features } from '@scholarxp/permissions';
import type { Request } from 'express';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthUser } from '../types/auth-user.type';
import { StudentProfileService } from './student-profile.service';
import { TutorProfileService } from './tutor-profile.service';

@Controller('profile')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class ProfileController {
  constructor(
    private readonly studentProfileService: StudentProfileService,
    private readonly tutorProfileService: TutorProfileService,
  ) {}

  @Get('student')
  @Authorize({ capability: features.navigation.profile, scope: 'global' })
  getStudentProfile(@Req() request: Request & { user?: AuthUser }) {
    return this.studentProfileService.getStudentProfile(
      request.user as AuthUser,
    );
  }

  @Get('tutor')
  @Authorize({ capability: features.navigation.profile, scope: 'global' })
  getTutorProfile(@Req() request: Request & { user?: AuthUser }) {
    return this.tutorProfileService.getTutorProfile(request.user as AuthUser);
  }
}
