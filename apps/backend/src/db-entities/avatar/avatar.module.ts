import { Module } from '@nestjs/common';
import { AvatarService } from './avatar.service';

@Module({
  providers: [AvatarService],
  // Exporting the service allows domain modules (like practice-room) to reuse avatar XP mutations.
  exports: [AvatarService],
})
export class AvatarModule {}
