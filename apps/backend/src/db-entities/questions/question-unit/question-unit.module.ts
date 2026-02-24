import { Module } from '@nestjs/common';
import { QuestionUnitService } from './question-unit.service';

@Module({
  providers: [QuestionUnitService],
  exports: [QuestionUnitService],
})
export class QuestionUnitModule {}
