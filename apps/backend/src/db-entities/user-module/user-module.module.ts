import { Module } from '@nestjs/common';
import { UserModuleService } from './user-module.service';
import { UserModuleController } from './user-module.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserModuleController],
  providers: [UserModuleService],
  // Exporting service allows domain modules to reuse module XP mutations.
  exports: [UserModuleService],
})
export class UserModuleModule {}
