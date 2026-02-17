import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../types/auth-user.type';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { DailyQuestService } from './daily-quest.service';
import { CreateDailyQuestDto } from './dto/create-daily-quest.dto';
import { GetQuestHistoryQueryDto } from './dto/get-quest-history-query.dto';
import { UpdateDailyQuestDto } from './dto/update-daily-quest.dto';

type DailyQuestHistoryRequest = Request & {
  user?: AuthUser;
};

@Controller('daily-quest')
export class DailyQuestController {
  constructor(private readonly dailyQuestService: DailyQuestService) {}

  @Post()
  create(@Body() createDailyQuestDto: CreateDailyQuestDto) {
    return this.dailyQuestService.create(createDailyQuestDto);
  }

  @Get('history')
  @UseGuards(SessionAuthGuard)
  getMyQuestHistory(
    @Req() request: DailyQuestHistoryRequest,
    @Query() query: GetQuestHistoryQueryDto,
  ) {
    // Guard guarantees authenticated session; cast keeps controller logic concise and type-safe.
    return this.dailyQuestService.listHistoryForUser(
      (request.user as AuthUser).id,
      query,
    );
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
