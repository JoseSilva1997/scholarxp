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
  NotFoundException,
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

// This controller serves module-scoped authoring/practice routes and unit-status updates.
@Controller()
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class ModuleUnitController {
  constructor(
    private readonly moduleUnitService: ModuleUnitService,
    private readonly questionUnitService: QuestionUnitService,
    private readonly moduleUnitQuestionGroupService: ModuleUnitQuestionGroupService,
  ) {}

  // Module-scoped creation aligned with frontend call: POST /module/:moduleId/units
  @Post('module/:moduleId/units')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  createForModule(
    @Param('moduleId') moduleId: string,
    @Body() createModuleUnitDto: CreateModuleUnitMinimalDto,
  ) {
    return this.moduleUnitService.createForModule(
      +moduleId,
      createModuleUnitDto,
    );
  }

  @Get('module/:moduleId/units')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  findByModule(@Param('moduleId') moduleId: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    // Student readers receive latest-attempt status in grouped question previews.
    const studentId = user.globalRole === 'student' ? user.id : undefined;
    return this.moduleUnitService.findByModule(+moduleId, studentId);
  }

  @Post('module/:moduleId/unit/:unitId/questions')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async createQuestionForUnit(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Body() body: CreateQuestionWithContentDto,
  ) {
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    if (!Number.isFinite(parsedModuleId) || !Number.isFinite(parsedUnitId)) {
      throw new NotFoundException('Module unit not found');
    }
    const result = await this.questionUnitService.createQuestionWithContent(
      parsedModuleId,
      parsedUnitId,
      body,
    );
    return result;
  }

  @Post('module/:moduleId/unit/:unitId/question-groups')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async createQuestionGroupForUnit(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Body() body: CreateModuleUnitQuestionGroupDto,
  ) {
    // Creating groups lazily avoids front-end race conditions when authors start with a draft group.
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    if (!Number.isFinite(parsedModuleId) || !Number.isFinite(parsedUnitId)) {
      throw new NotFoundException('Module unit not found');
    }
    if (body.moduleUnitId !== parsedUnitId) {
      throw new NotFoundException('Module unit not found');
    }
    const unit = await this.moduleUnitService.findOne(parsedUnitId);
    if (!unit || unit.moduleId !== parsedModuleId) {
      throw new NotFoundException('Module unit not found');
    }
    return this.moduleUnitQuestionGroupService.create(body);
  }

  @Post('module/:moduleId/unit/:unitId/questions/:questionId/variants')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async createVariantForQuestion(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('questionId') questionId: string,
    @Body() body: CreateVariantWithContentDto,
  ) {
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    const parsedQuestionId = Number(questionId);
    if (
      !Number.isFinite(parsedModuleId) ||
      !Number.isFinite(parsedUnitId) ||
      !Number.isFinite(parsedQuestionId)
    ) {
      throw new NotFoundException('Module unit not found');
    }
    const result = await this.questionUnitService.createVariantWithContent(
      parsedModuleId,
      parsedUnitId,
      parsedQuestionId,
      body,
    );
    return result;
  }

  @Patch(
    'module/:moduleId/unit/:unitId/questions/:questionId/content/:contentId',
  )
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async updateQuestionContent(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('questionId') questionId: string,
    @Param('contentId') contentId: string,
    @Body() body: UpdateQuestionContentDto,
  ) {
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    const parsedQuestionId = Number(questionId);
    const parsedContentId = Number(contentId);
    if (
      !Number.isFinite(parsedModuleId) ||
      !Number.isFinite(parsedUnitId) ||
      !Number.isFinite(parsedQuestionId) ||
      !Number.isFinite(parsedContentId)
    ) {
      throw new NotFoundException('Module unit not found');
    }
    return this.questionUnitService.updateContentScoped(
      parsedModuleId,
      parsedUnitId,
      parsedQuestionId,
      parsedContentId,
      body,
    );
  }

  @Delete('module/:moduleId/unit/:unitId/questions/:questionId')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async deleteQuestion(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('questionId') questionId: string,
  ) {
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    const parsedQuestionId = Number(questionId);
    if (
      !Number.isFinite(parsedModuleId) ||
      !Number.isFinite(parsedUnitId) ||
      !Number.isFinite(parsedQuestionId)
    ) {
      throw new NotFoundException('Question not found');
    }
    return this.questionUnitService.removeScoped(
      parsedModuleId,
      parsedUnitId,
      parsedQuestionId,
    );
  }

  @Delete(
    'module/:moduleId/unit/:unitId/questions/:questionId/variants/:variantId',
  )
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async deleteVariant(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('questionId') questionId: string,
    @Param('variantId') variantId: string,
  ) {
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    const parsedQuestionId = Number(questionId);
    const parsedVariantId = Number(variantId);
    if (
      !Number.isFinite(parsedModuleId) ||
      !Number.isFinite(parsedUnitId) ||
      !Number.isFinite(parsedQuestionId) ||
      !Number.isFinite(parsedVariantId)
    ) {
      throw new NotFoundException('Variant not found');
    }
    return this.questionUnitService.removeVariantScoped(
      parsedModuleId,
      parsedUnitId,
      parsedQuestionId,
      parsedVariantId,
    );
  }

  @Delete('module/:moduleId/unit/:unitId/question-groups/:groupId')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async deleteQuestionGroup(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
  ) {
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    const parsedGroupId = Number(groupId);
    if (
      !Number.isFinite(parsedModuleId) ||
      !Number.isFinite(parsedUnitId) ||
      !Number.isFinite(parsedGroupId)
    ) {
      throw new NotFoundException('Question group not found');
    }
    return this.moduleUnitQuestionGroupService.removeScoped(
      parsedModuleId,
      parsedUnitId,
      parsedGroupId,
    );
  }

  @Patch('module/:moduleId/unit/:unitId/question-groups/:groupId')
  @Authorize({ capability: features.modules.manageContent, scope: 'module' })
  async renameQuestionGroup(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Body() body: UpdateModuleUnitQuestionGroupNameDto,
  ) {
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    const parsedGroupId = Number(groupId);
    if (
      !Number.isFinite(parsedModuleId) ||
      !Number.isFinite(parsedUnitId) ||
      !Number.isFinite(parsedGroupId)
    ) {
      throw new NotFoundException('Question group not found');
    }
    return this.moduleUnitQuestionGroupService.renameScoped(
      parsedModuleId,
      parsedUnitId,
      parsedGroupId,
      body.name,
    );
  }

  @Get('module/:moduleId/unit/:unitId/editor')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  async getEditorPayload(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
  ) {
    const unit = await this.moduleUnitService.findEditorPayload(+unitId);
    if (unit.moduleId !== +moduleId) {
      throw new NotFoundException('Module unit not found');
    }
    return unit;
  }

  @Patch('module-unit/:id')
  @Authorize({
    capability: features.modules.manageContent,
    scope: 'module',
    moduleContextSource: 'module_unit',
  })
  update(
    @Param('id') id: string,
    @Body() updateModuleUnitDto: UpdateModuleUnitDto,
  ) {
    return this.moduleUnitService.update(+id, updateModuleUnitDto);
  }
}
