import { Module } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ModuleController } from './module.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ModuleController],
  providers: [ModuleService],
})
export class ModuleModule {}
