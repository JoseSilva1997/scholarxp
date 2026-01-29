import { Module } from '@nestjs/common';
import { UserModuleService } from './user-module.service';
import { UserModuleController } from './user-module.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserModuleController],
  providers: [UserModuleService],
})
export class UserModuleModule {}
