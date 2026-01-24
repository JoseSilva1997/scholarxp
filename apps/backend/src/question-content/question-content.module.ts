import { Module } from '@nestjs/common';
import { QuestionContentService } from './question-content.service';
import { QuestionContentController } from './question-content.controller';

@Module({
  controllers: [QuestionContentController],
  providers: [QuestionContentService],
})
export class QuestionContentModule {}
