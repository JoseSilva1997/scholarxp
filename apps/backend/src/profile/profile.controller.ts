// Handles HTTP routing for the /profile endpoint group. Routes are split by role (student/tutor)
// so each profile view can evolve its aggregation independently without conditional branching here.
// Pattern: thin controller — all domain and role-enforcement logic lives in role-specific services.
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { features } from '@scholarxp/permissions';
import type { Request } from 'express';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthUser } from '@scholarxp/api-contracts';
import { StudentProfileService } from './student-profile.service';
import { TutorProfileService } from './tutor-profile.service';

@Controller('profile')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class ProfileController {
  constructor(
    private readonly studentProfileService: StudentProfileService,
    private readonly tutorProfileService: TutorProfileService,
  ) {}

  // Returns the full student profile dashboard payload. The `scope: 'global'` on @Authorize means
  // the capability is checked against the user's platform-level role, not a specific module membership.
  // Role enforcement (student-only) is handled inside StudentProfileService, not here.
  @Get('student')
  @Authorize({ capability: features.navigation.profile, scope: 'global' })
  getStudentProfile(@Req() request: Request & { user?: AuthUser }) {
    return this.studentProfileService.getStudentProfile(
      request.user as AuthUser,
    );
  }

  // Returns the full tutor profile dashboard payload. Mirrors the student route in structure;
  // role enforcement (teacher-only) is delegated to TutorProfileService.
  @Get('tutor')
  @Authorize({ capability: features.navigation.profile, scope: 'global' })
  getTutorProfile(@Req() request: Request & { user?: AuthUser }) {
    return this.tutorProfileService.getTutorProfile(request.user as AuthUser);
  }
}
