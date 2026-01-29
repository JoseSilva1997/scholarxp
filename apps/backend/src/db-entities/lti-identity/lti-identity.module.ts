import { Module } from '@nestjs/common';
import { LtiIdentityService } from './lti-identity.service';
import { LtiIdentityController } from './lti-identity.controller';

@Module({
  controllers: [LtiIdentityController],
  providers: [LtiIdentityService],
})
export class LtiIdentityModule {}
