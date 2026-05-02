// NestJS module wiring up invite CRUD routes and the redeem endpoint behind AuthModule guards.
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
