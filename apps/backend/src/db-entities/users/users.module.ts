// NestJS module for user account management. Imports StorageModule for profile picture
// uploads and AuthModule so the controller can refresh the session after profile changes.
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../file-storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
