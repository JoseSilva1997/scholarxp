import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PracticeSessionService } from './practice-session.service';
import { CreatePracticeSessionDto } from './dto/create-practice-session.dto';
import { UpdatePracticeSessionDto } from './dto/update-practice-session.dto';

@Controller('practice-session')
export class PracticeSessionController {
  constructor(
    private readonly practiceSessionService: PracticeSessionService,
  ) {}

  @Post()
  create(@Body() createPracticeSessionDto: CreatePracticeSessionDto) {
    return this.practiceSessionService.create(createPracticeSessionDto);
  }

  @Get()
  findAll() {
    return this.practiceSessionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.practiceSessionService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePracticeSessionDto: UpdatePracticeSessionDto,
  ) {
    return this.practiceSessionService.update(+id, updatePracticeSessionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.practiceSessionService.remove(+id);
  }
}
