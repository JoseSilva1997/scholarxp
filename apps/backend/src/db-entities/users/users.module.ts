import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
