import { Module } from '@nestjs/common';
import { QuestionVariantService } from './question-variant.service';

@Module({
  providers: [QuestionVariantService],
})
export class QuestionVariantModule {}
