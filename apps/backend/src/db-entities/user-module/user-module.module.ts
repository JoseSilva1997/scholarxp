import { Module } from '@nestjs/common';
import { UserModuleService } from './user-module.service';
import { UserModuleController } from './user-module.controller';

@Module({
  controllers: [UserModuleController],
  providers: [UserModuleService],
})
export class UserModuleModule {}
