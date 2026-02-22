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
import { QuestionUnitService } from './question-unit.service';
import { CreateQuestionUnitDto } from './dto/create-question-unit.dto';
import { UpdateQuestionUnitDto } from './dto/update-question-unit.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SessionAuthGuard } from 'src/auth/guards/session-auth.guard';

@Controller('question-unit')
@UseGuards(SessionAuthGuard, RolesGuard)
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
  update(
    @Param('id') id: string,
    @Body() updateQuestionUnitDto: UpdateQuestionUnitDto,
  ) {
    return this.questionUnitService.update(+id, updateQuestionUnitDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionUnitService.remove(+id);
  }
}
