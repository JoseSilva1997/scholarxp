import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DailyQuestService } from './daily-quest.service';
import { CreateDailyQuestDto } from './dto/create-daily-quest.dto';
import { UpdateDailyQuestDto } from './dto/update-daily-quest.dto';

@Controller('daily-quest')
export class DailyQuestController {
  constructor(private readonly dailyQuestService: DailyQuestService) {}

  @Post()
  create(@Body() createDailyQuestDto: CreateDailyQuestDto) {
    return this.dailyQuestService.create(createDailyQuestDto);
  }

  @Get()
  findAll() {
    return this.dailyQuestService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dailyQuestService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDailyQuestDto: UpdateDailyQuestDto,
  ) {
    return this.dailyQuestService.update(+id, updateDailyQuestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dailyQuestService.remove(+id);
  }
}
