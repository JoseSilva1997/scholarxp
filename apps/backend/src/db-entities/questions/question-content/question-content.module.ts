// NestJS module providing QuestionContentService for internal use. Not exported; higher-level
// content operations are exposed through QuestionUnitModule which owns the authoring flow.
import { Module } from '@nestjs/common';
import { QuestionContentService } from './question-content.service';

@Module({
  providers: [QuestionContentService],
})
export class QuestionContentModule {}
