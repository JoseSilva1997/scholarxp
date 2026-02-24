import { Module } from '@nestjs/common';
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';

@Module({
  providers: [ModuleUnitQuestionGroupService],
  exports: [ModuleUnitQuestionGroupService],
})
export class ModuleUnitQuestionGroupModule {}
