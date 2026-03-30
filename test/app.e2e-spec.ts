import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('/api/v1/system/health/live (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/system/health/live')
        .expect(200)
        .expect(res => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBe('ok');
          expect(res.body.data.checks.app).toBe('ok');
        });
    });

    it('/api/v1/system/health/ready (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/system/health/ready')
        .expect(200)
        .expect(res => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBeDefined();
          expect(res.body.data.checks).toBeDefined();
        });
    });
  });
});
