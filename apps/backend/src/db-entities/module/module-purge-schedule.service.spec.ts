// Spec role: verifies the scheduled module purge delegates cleanup without duplicating archive policy.
import { Logger } from '@nestjs/common';
import { ModulePurgeScheduleService } from './module-purge-schedule.service';
import { ModuleService } from './module.service';

describe('ModulePurgeScheduleService', () => {
  let service: ModulePurgeScheduleService;
  let moduleService: Pick<ModuleService, 'purgeEligibleArchivedModules'>;

  beforeEach(() => {
    moduleService = {
      purgeEligibleArchivedModules: jest
        .fn()
        .mockResolvedValue({ purgedModuleCount: 0 }),
    };
    service = new ModulePurgeScheduleService(moduleService as ModuleService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('delegates scheduled purge to ModuleService', async () => {
    const result = await service.purgeEligibleArchivedModules();

    expect(moduleService.purgeEligibleArchivedModules).toHaveBeenCalledWith();
    expect(result).toEqual({ purgedModuleCount: 0 });
  });

  it('logs when archived modules are purged', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    (moduleService.purgeEligibleArchivedModules as jest.Mock).mockResolvedValue(
      { purgedModuleCount: 2 },
    );

    await service.purgeEligibleArchivedModules();

    expect(logSpy).toHaveBeenCalledWith(
      'Purged 2 eligible archived module(s).',
    );
  });
});
