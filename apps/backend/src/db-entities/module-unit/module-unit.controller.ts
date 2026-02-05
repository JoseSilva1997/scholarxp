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
import { CreateModuleUnitDto } from './dto/create-module-unit.dto';
import { UpdateModuleUnitDto } from './dto/update-module-unit.dto';
import { CreateModuleUnitMinimalDto } from './dto/create-module-unit-minimal.dto';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { ModuleAccessGuard } from '../../auth/guards/module-access.guard';
import { ModuleAccess } from '../../auth/decorators/module-access.decorator';
import { assertHasAccess } from '../../helpers/permissions.helper';
import type { AuthUser } from '../../types/auth-user.type';
import { QuestionUnitService } from '../questions/question-unit/question-unit.service';
import { CreateQuestionWithContentDto } from '../questions/question-unit/dto/create-question-with-content.dto';
import { CreateVariantWithContentDto } from '../questions/question-unit/dto/create-variant-with-content.dto';
import { UpdateQuestionContentDto } from '../questions/question-content/dto/update-question-content.dto';
import { ModuleUnitQuestionGroupService } from '../module-unit-question-group/module-unit-question-group.service';
import { CreateModuleUnitQuestionGroupDto } from '../module-unit-question-group/dto/create-module-unit-question-group.dto';

// This controller serves both `/module-unit` CRUD endpoints and the module-scoped create route `/module/:moduleId/units`.
@Controller()
export class ModuleUnitController {
  constructor(
    private readonly moduleUnitService: ModuleUnitService,
    private readonly questionUnitService: QuestionUnitService,
    private readonly moduleUnitQuestionGroupService: ModuleUnitQuestionGroupService,
  ) {}

  // Module-scoped creation aligned with frontend call: POST /module/:moduleId/units
  @Post('module/:moduleId/units')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId' })
  createForModule(
    @Param('moduleId') moduleId: string,
    @Body() createModuleUnitDto: CreateModuleUnitMinimalDto,
    @Req() req: Request,
  ) {
    assertHasAccess('modules.manageContent', req.user as AuthUser);
    return this.moduleUnitService.createForModule(
      +moduleId,
      createModuleUnitDto,
    );
  }

  @Post('module-unit')
  create(@Body() createModuleUnitDto: CreateModuleUnitDto) {
    return this.moduleUnitService.create(createModuleUnitDto);
  }

  @Get('module-unit')
  findAll() {
    return this.moduleUnitService.findAll();
  }

  @Get('module/:moduleId/units')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId', allowStudentRead: true })
  findByModule(@Param('moduleId') moduleId: string) {
    return this.moduleUnitService.findByModule(+moduleId);
  }

  @Get('module-unit/:id')
  findOne(@Param('id') id: string) {
    return this.moduleUnitService.findOne(+id);
  }

  @Post('module/:moduleId/unit/:unitId/questions')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId' })
  async createQuestionForUnit(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Body() body: CreateQuestionWithContentDto,
    @Req() req: Request,
  ) {
    assertHasAccess('modules.manageContent', req.user as AuthUser);
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
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId' })
  async createQuestionGroupForUnit(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Body() body: CreateModuleUnitQuestionGroupDto,
    @Req() req: Request,
  ) {
    assertHasAccess('modules.manageContent', req.user as AuthUser);
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
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId' })
  async createVariantForQuestion(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('questionId') questionId: string,
    @Body() body: CreateVariantWithContentDto,
    @Req() req: Request,
  ) {
    assertHasAccess('modules.manageContent', req.user as AuthUser);
    const parsedModuleId = Number(moduleId);
    const parsedUnitId = Number(unitId);
    const parsedQuestionId = Number(questionId);
    if (!Number.isFinite(parsedModuleId) || !Number.isFinite(parsedUnitId) || !Number.isFinite(parsedQuestionId)) {
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

  @Patch('module/:moduleId/unit/:unitId/questions/:questionId/content/:contentId')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId' })
  async updateQuestionContent(
    @Param('moduleId') moduleId: string,
    @Param('unitId') unitId: string,
    @Param('questionId') questionId: string,
    @Param('contentId') contentId: string,
    @Body() body: UpdateQuestionContentDto,
    @Req() req: Request,
  ) {
    assertHasAccess('modules.manageContent', req.user as AuthUser);
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

  @Get('module/:moduleId/unit/:unitId/editor')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId', allowStudentRead: true })
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
  update(
    @Param('id') id: string,
    @Body() updateModuleUnitDto: UpdateModuleUnitDto,
  ) {
    return this.moduleUnitService.update(+id, updateModuleUnitDto);
  }

  @Delete('module-unit/:id')
  remove(@Param('id') id: string) {
    return this.moduleUnitService.remove(+id);
  }
}
