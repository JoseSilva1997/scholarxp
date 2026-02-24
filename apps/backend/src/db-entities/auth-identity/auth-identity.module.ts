import { Module } from '@nestjs/common';
import { AuthIdentityService } from './auth-identity.service';

@Module({
  providers: [AuthIdentityService],
  exports: [AuthIdentityService],
})
export class AuthIdentityModule {}
