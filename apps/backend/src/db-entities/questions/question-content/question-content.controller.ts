import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { QuestionContentService } from './question-content.service';
import { CreateQuestionContentDto } from './dto/create-question-content.dto';
import { UpdateQuestionContentDto } from './dto/update-question-content.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('question-content')
@UseGuards(SessionAuthGuard, RolesGuard)
export class QuestionContentController {
  constructor(
    private readonly questionContentService: QuestionContentService,
  ) {}

  @Post()
  create(@Body() createQuestionContentDto: CreateQuestionContentDto) {
    return this.questionContentService.create(createQuestionContentDto);
  }

  @Get()
  findAll() {
    return this.questionContentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionContentService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuestionContentDto: UpdateQuestionContentDto,
  ) {
    return this.questionContentService.update(+id, updateQuestionContentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionContentService.remove(+id);
  }
}
