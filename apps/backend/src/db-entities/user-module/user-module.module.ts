import { Module } from '@nestjs/common';
import { UserModuleService } from './user-module.service';

@Module({
  providers: [UserModuleService],
  // Exporting service allows domain modules to reuse module XP mutations.
  exports: [UserModuleService],
})
export class UserModuleModule {}
