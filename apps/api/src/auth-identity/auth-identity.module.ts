import { Module } from '@nestjs/common';
import { AuthIdentityService } from './auth-identity.service';
import { AuthIdentityController } from './auth-identity.controller';

@Module({
  controllers: [AuthIdentityController],
  providers: [AuthIdentityService],
})
export class AuthIdentityModule {}
