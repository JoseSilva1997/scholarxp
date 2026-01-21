import { Module } from '@nestjs/common';
import { QuestionVariantService } from './question-variant.service';
import { QuestionVariantController } from './question-variant.controller';

@Module({
  controllers: [QuestionVariantController],
  providers: [QuestionVariantService],
})
export class QuestionVariantModule {}
