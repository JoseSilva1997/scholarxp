// Role: validates daily-practice unlock timing so the feature only appears after baseline lesson completion and the next local day boundary.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertSafeE2eDatabaseUrl,
  clearDailyPracticeE2eDatabase,
  createDailyPracticeE2eApp,
  seedStudentModuleScenario,
  setAuthenticatedUserId,
} from './helpers';
import {
  seedStudentDay1CompleteScenario,
  seedStudentNewScenario,
} from './scenarios';

describe('Daily practice unlock rules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const harness = await createDailyPracticeE2eApp();
    app = harness.app;
    prisma = harness.prisma;
  });

  beforeEach(async () => {
    assertSafeE2eDatabaseUrl();
    await clearDailyPracticeE2eDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('locks daily practice when the student has not completed any lesson in the module', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentNewScenario(prisma, base);

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe(
          'Complete your first lesson in this module to unlock daily practice tomorrow.',
        );
      });
  });

  it('keeps daily practice locked until the next local day after the first lesson completion', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentDay1CompleteScenario(prisma, base);

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe(
          'Daily practice unlocks tomorrow after you complete your first lesson in this module.',
        );
      });
  });
});
