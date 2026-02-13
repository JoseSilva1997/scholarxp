import { Module } from '@nestjs/common';
import { AvatarService } from './avatar.service';
import { AvatarController } from './avatar.controller';

@Module({
  controllers: [AvatarController],
  providers: [AvatarService],
  // Exporting the service allows domain modules (like practice-room) to reuse avatar XP mutations.
  exports: [AvatarService],
})
export class AvatarModule {}
