// NestJS module providing UserPasswordService to the auth layer for local credential management.
import { Module } from '@nestjs/common';
import { UserPasswordService } from './user-password.service';

@Module({
  providers: [UserPasswordService],
})
export class UserPasswordModule {}
