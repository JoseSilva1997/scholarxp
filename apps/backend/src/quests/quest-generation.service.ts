// Role: owns quest-day generation orchestration so quest selection rules stay out of CRUD services and controllers.
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuestGenerationService {
  // This seam exists so future quest selection rules can be added without changing read controllers or storage services.
  async ensureQuestDayGeneratedForUser(userId: number): Promise<void> {
    void userId;
    // Quest generation rules are introduced incrementally in the next step.
    // Keeping this method explicit now gives the backend one stable orchestration entrypoint.
    return Promise.resolve();
  }
}
