// NestJS module providing QuestionVariantService for internal use. Not exported; variant
// creation and deletion are orchestrated by QuestionUnitService with module/unit scope checks.
import { Module } from '@nestjs/common';
import { QuestionVariantService } from './question-variant.service';

@Module({
  providers: [QuestionVariantService],
})
export class QuestionVariantModule {}
