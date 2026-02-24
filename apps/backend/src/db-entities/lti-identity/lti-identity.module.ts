import { Module } from '@nestjs/common';
import { LtiIdentityService } from './lti-identity.service';
@Module({
  providers: [LtiIdentityService],
  exports: [LtiIdentityService],
})
export class LtiIdentityModule {}
