// NestJS module exporting ModuleUnitQuestionGroupService for use by the module-unit controller.
import { Module } from '@nestjs/common';
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';

@Module({
  providers: [ModuleUnitQuestionGroupService],
  exports: [ModuleUnitQuestionGroupService],
})
export class ModuleUnitQuestionGroupModule {}
