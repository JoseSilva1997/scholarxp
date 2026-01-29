import { Module } from '@nestjs/common';
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';
import { ModuleUnitQuestionGroupController } from './module-unit-question-group.controller';

@Module({
  controllers: [ModuleUnitQuestionGroupController],
  providers: [ModuleUnitQuestionGroupService],
})
export class ModuleUnitQuestionGroupModule {}
