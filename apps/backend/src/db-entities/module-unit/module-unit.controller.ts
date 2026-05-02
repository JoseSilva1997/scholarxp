import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { ModuleUnitService } from './module-unit.service';
import { UpdateModuleUnitDto } from './dto/update-module-unit.dto';
import { CreateModuleUnitMinimalDto } from './dto/create-module-unit-minimal.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { Authorize } from '../../auth/decorators/authorize.decorator';
import type { AuthUser } from '../../types/auth-user.type';
import { QuestionUnitService } from '../questions/question-unit/question-unit.service';
import { CreateQuestionWithContentDto } from '../questions/question-unit/dto/create-question-with-content.dto';
import { CreateVariantWithContentDto } from '../questions/question-unit/dto/create-variant-with-content.dto';
import { UpdateQuestionContentDto } from '../questions/question-content/dto/update-question-content.dto';
import { ModuleUnitQuestionGroupService } from '../module-unit-question-group/module-unit-question-group.service';
import { CreateModuleUnitQuestionGroupDto } from '../module-unit-question-group/dto/create-module-unit-question-group.dto';
import { UpdateModuleUnitQuestionGroupNameDto } from '../module-unit-question-group/dto/update-module-unit-question-group-name.dto';
import { features } from '@scholarxp/permissions';

// HTTP controller for module unit management. Exposes authoring routes (create unit, manage questions/groups)
// and a student-facing list route. All routes are protected by session auth and capability-based authorisation.
@Controller()
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class ModuleUnitController {
  constructor(
    private readonly moduleUnitService: ModuleUnitService,
    private readonly questionUnitService: QuestionUnitService,
    private readonly moduleUnitQuestionGroupService: ModuleUnitQuestionGroupService,
  ) {}

  @Post('module/:moduleId/units')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  createForModule(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Body() createModuleUnitDto: CreateModuleUnitMinimalDto,
  ) {
    return this.moduleUnitService.createForModule(
      moduleId,
      createModuleUnitDto,
    );
  }

  @Get('module/:moduleId/units')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  findByModule(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    // Student readers receive latest-attempt status in grouped question previews.
    const studentId = user.globalRole === 'student' ? user.id : undefined;
    return this.moduleUnitService.findByModule(moduleId, studentId);
  }

  @Post('module/:moduleId/unit/:unitId/questions')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async createQuestionForUnit(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Body() body: CreateQuestionWithContentDto,
  ) {
    const result = await this.questionUnitService.createQuestionWithContent(
      moduleId,
      unitId,
      body,
    );
    return result;
  }

  @Post('module/:moduleId/unit/:unitId/question-groups')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async createQuestionGroupForUnit(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Body() body: CreateModuleUnitQuestionGroupDto,
  ) {
    return this.moduleUnitQuestionGroupService.createScoped(
      moduleId,
      unitId,
      body,
    );
  }

  @Post('module/:moduleId/unit/:unitId/questions/:questionId/variants')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async createVariantForQuestion(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: CreateVariantWithContentDto,
  ) {
    return await this.questionUnitService.createVariantWithContent(
      moduleId,
      unitId,
      questionId,
      body,
    );
  }

  @Patch(
    'module/:moduleId/unit/:unitId/questions/:questionId/content/:contentId',
  )
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async updateQuestionContent(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Param('contentId', ParseIntPipe) contentId: number,
    @Body() body: UpdateQuestionContentDto,
  ) {
    return this.questionUnitService.updateContentScoped(
      moduleId,
      unitId,
      questionId,
      contentId,
      body,
    );
  }

  @Delete('module/:moduleId/unit/:unitId/questions/:questionId')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async deleteQuestion(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.questionUnitService.removeScoped(moduleId, unitId, questionId);
  }

  @Delete(
    'module/:moduleId/unit/:unitId/questions/:questionId/variants/:variantId',
  )
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async deleteVariant(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
  ) {
    return this.questionUnitService.removeVariantScoped(
      moduleId,
      unitId,
      questionId,
      variantId,
    );
  }

  @Delete('module/:moduleId/unit/:unitId/question-groups/:groupId')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async deleteQuestionGroup(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.moduleUnitQuestionGroupService.removeScoped(
      moduleId,
      unitId,
      groupId,
    );
  }

  @Patch('module/:moduleId/unit/:unitId/question-groups/:groupId')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async renameQuestionGroup(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: UpdateModuleUnitQuestionGroupNameDto,
  ) {
    return this.moduleUnitQuestionGroupService.renameScoped(
      moduleId,
      unitId,
      groupId,
      body.name,
    );
  }

  @Get('module/:moduleId/unit/:unitId/editor')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async getEditorPayload(
    @Param('moduleId', ParseIntPipe) moduleId: number,
    @Param('unitId', ParseIntPipe) unitId: number,
  ) {
    return this.moduleUnitService.findEditorPayload(moduleId, unitId);
  }

  @Patch('module-unit/:id')
  @Authorize({
    capability: features.modules.manageContent,
    scope: 'module',
    moduleContextSource: 'module_unit',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateModuleUnitDto: UpdateModuleUnitDto,
  ) {
    return this.moduleUnitService.update(id, updateModuleUnitDto);
  }
}
