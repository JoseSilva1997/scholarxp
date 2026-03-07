import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('returns 404 for GET / because no root route is registered', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(404);
  });

  it('returns test diagnostics payload from GET /test', () => {
    return request(app.getHttpServer())
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
