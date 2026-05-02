/* Service role: periodically closes stale practice sessions so abandoned tabs
 do not leave sessions open forever.
 */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PracticeRoomSessionService } from './practice-session.service';

const SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_SESSION_MINUTES = 60;

@Injectable()
export class PracticeRoomSessionSweepService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PracticeRoomSessionSweepService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly practiceRoomSessionService: PracticeRoomSessionService,
  ) {}

  // Starts the recurring sweep timer when the NestJS module is initialized.
  // Implements OnModuleInit lifecycle hook — NestJS calls this automatically after DI is complete.
  onModuleInit() {
    // A fixed interval keeps stale-session cleanup predictable without requiring external scheduler infrastructure.
    this.sweepTimer = setInterval(() => {
      void this.runSweep();
    }, SESSION_SWEEP_INTERVAL_MS);
    // unref() prevents the interval from keeping the Node.js process alive when all other
    // work is done (e.g. during graceful shutdown or in test environments).
    this.sweepTimer.unref?.();
  }

  // Cancels the sweep timer when the NestJS module is torn down, preventing timer leaks
  // during application shutdown or hot-reloads in development.
  // Implements OnModuleDestroy lifecycle hook.
  onModuleDestroy() {
    if (!this.sweepTimer) {
      return;
    }
    clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  // Executes one sweep cycle: delegates to the session service and logs when sessions
  // are actually closed. Errors are caught and logged so a failing sweep never crashes the process.
  private async runSweep() {
    try {
      // Depend on the lifecycle service directly so the sweep does not route through facade orchestration.
      const result = await this.practiceRoomSessionService.closeStaleSessions({
        inactivityMinutes: STALE_SESSION_MINUTES,
      });
      if (result.closedCount > 0) {
        this.logger.log(
          `Closed ${result.closedCount} stale practice session(s).`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to close stale practice sessions.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
