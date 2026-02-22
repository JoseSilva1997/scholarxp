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
import { QuestionVariantService } from './question-variant.service';
import { CreateQuestionVariantDto } from './dto/create-question-variant.dto';
import { UpdateQuestionVariantDto } from './dto/update-question-variant.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('question-variant')
@UseGuards(SessionAuthGuard, RolesGuard)
export class QuestionVariantController {
  constructor(
    private readonly questionVariantService: QuestionVariantService,
  ) {}

  @Post()
  create(@Body() createQuestionVariantDto: CreateQuestionVariantDto) {
    return this.questionVariantService.create(createQuestionVariantDto);
  }

  @Get()
  findAll() {
    return this.questionVariantService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionVariantService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuestionVariantDto: UpdateQuestionVariantDto,
  ) {
    return this.questionVariantService.update(+id, updateQuestionVariantDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionVariantService.remove(+id);
  }
}
