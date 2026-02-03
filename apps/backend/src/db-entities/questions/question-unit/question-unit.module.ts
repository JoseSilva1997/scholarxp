import { Module } from '@nestjs/common';
import { QuestionUnitService } from './question-unit.service';
import { QuestionUnitController } from './question-unit.controller';

@Module({
  controllers: [QuestionUnitController],
  providers: [QuestionUnitService],
})
export class QuestionUnitModule {}
