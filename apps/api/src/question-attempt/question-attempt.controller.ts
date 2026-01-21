import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { QuestionAttemptService } from './question-attempt.service';
import { CreateQuestionAttemptDto } from './dto/create-question-attempt.dto';
import { UpdateQuestionAttemptDto } from './dto/update-question-attempt.dto';

@Controller('question-attempt')
export class QuestionAttemptController {
  constructor(private readonly questionAttemptService: QuestionAttemptService) {}

  @Post()
  create(@Body() createQuestionAttemptDto: CreateQuestionAttemptDto) {
    return this.questionAttemptService.create(createQuestionAttemptDto);
  }

  @Get()
  findAll() {
    return this.questionAttemptService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionAttemptService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuestionAttemptDto: UpdateQuestionAttemptDto) {
    return this.questionAttemptService.update(+id, updateQuestionAttemptDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionAttemptService.remove(+id);
  }
}
