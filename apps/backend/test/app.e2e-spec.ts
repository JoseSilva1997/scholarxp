import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DailyPracticeGenerationScheduleService } from '../src/daily-practice/daily-practice-generation-schedule.service';
import { QuestGenerationStartupService } from '../src/quests/quest-generation-startup.service';

describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // App bootstrap assertions are not about startup generation batches, so suppress them to keep teardown deterministic.
      .overrideProvider(DailyPracticeGenerationScheduleService)
      .useValue({ onModuleInit: () => {} })
      .overrideProvider(QuestGenerationStartupService)
      .useValue({ onModuleInit: () => {} })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404 for GET / because no root route is registered', () => {
    return request(app.getHttpAdapter().getInstance()).get('/').expect(404);
  });

  it('returns test diagnostics payload from GET /test', () => {
    return request(app.getHttpAdapter().getInstance())
      .get('/test')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            users: expect.any(Number),
          }),
        );
      });
  });
});
