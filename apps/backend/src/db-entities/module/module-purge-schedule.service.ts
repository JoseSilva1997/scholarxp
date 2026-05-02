// Module archive cleanup job: permanently removes old archived modules only after learner-impact checks pass.
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ModuleService } from './module.service';

@Injectable()
export class ModulePurgeScheduleService {
  private readonly logger = new Logger(ModulePurgeScheduleService.name);

  constructor(private readonly moduleService: ModuleService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeEligibleArchivedModules() {
    const result = await this.moduleService.purgeEligibleArchivedModules();
    if (result.purgedModuleCount > 0) {
      this.logger.log(
        `Purged ${result.purgedModuleCount} eligible archived module(s).`,
      );
    }
    return result;
  }
}
