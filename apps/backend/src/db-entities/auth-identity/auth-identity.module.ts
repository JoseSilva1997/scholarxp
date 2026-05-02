// NestJS module that exposes AuthIdentityService for use by the auth layer and other consumers.
import { Module } from '@nestjs/common';
import { AuthIdentityService } from './auth-identity.service';

@Module({
  providers: [AuthIdentityService],
  exports: [AuthIdentityService],
})
export class AuthIdentityModule {}
