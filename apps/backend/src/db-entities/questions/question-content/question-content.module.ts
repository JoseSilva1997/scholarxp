import { Module } from '@nestjs/common';
import { QuestionContentService } from './question-content.service';

@Module({
  providers: [QuestionContentService],
})
export class QuestionContentModule {}
