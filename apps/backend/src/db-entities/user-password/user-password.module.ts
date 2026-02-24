import { Module } from '@nestjs/common';
import { UserPasswordService } from './user-password.service';

@Module({
  providers: [UserPasswordService],
})
export class UserPasswordModule {}
