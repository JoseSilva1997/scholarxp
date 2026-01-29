import { Module } from '@nestjs/common';
import { ModuleInviteService } from './module-invite.service';
import { ModuleInviteController } from './module-invite.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ModuleInviteController],
  providers: [ModuleInviteService],
})
export class ModuleInviteModule {}
