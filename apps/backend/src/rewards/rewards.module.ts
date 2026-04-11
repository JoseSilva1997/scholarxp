// Cosmetic rewards domain: hosts the equip mutation and shares the AuthModule guards.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [AuthModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
