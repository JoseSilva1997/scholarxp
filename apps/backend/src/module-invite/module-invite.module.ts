import { Module } from '@nestjs/common';
import { ModuleInviteService } from './module-invite.service';
import { ModuleInviteController } from './module-invite.controller';

@Module({
  controllers: [ModuleInviteController],
  providers: [ModuleInviteService],
})
export class ModuleInviteModule {}
