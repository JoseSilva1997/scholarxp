import { Module } from '@nestjs/common';
import { DailyQuestService } from './daily-quest.service';
import { DailyQuestController } from './daily-quest.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DailyQuestController],
  providers: [DailyQuestService],
})
export class DailyQuestModule {}
