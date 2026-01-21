import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { QuestionUnitService } from './question-unit.service';
import { CreateQuestionUnitDto } from './dto/create-question-unit.dto';
import { UpdateQuestionUnitDto } from './dto/update-question-unit.dto';

@Controller('question-unit')
export class QuestionUnitController {
  constructor(private readonly questionUnitService: QuestionUnitService) {}

  @Post()
  create(@Body() createQuestionUnitDto: CreateQuestionUnitDto) {
    return this.questionUnitService.create(createQuestionUnitDto);
  }

  @Get()
  findAll() {
    return this.questionUnitService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionUnitService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuestionUnitDto: UpdateQuestionUnitDto) {
    return this.questionUnitService.update(+id, updateQuestionUnitDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionUnitService.remove(+id);
  }
}
