import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import session, { type Store as SessionStore } from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import csrf from 'csurf';
import passport from 'passport';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppModule } from './app.module';
import { FRONTEND_URL } from './constants';
import { SafeExceptionFilter } from './common/filters/safe-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProd =
    (config.get<string>('NODE_ENV') ?? 'development') === 'production';
  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? FRONTEND_URL;
  const sessionSecret =
    config.get<string>('SESSION_SECRET') ?? 'dev-session-secret';
  const databaseUrl = config.get<string>('DATABASE_URL');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // Standardize outward-facing errors and keep internal details in server logs.
  app.useGlobalFilters(new SafeExceptionFilter());
  // Required when running behind a proxy (Heroku/Render/NGINX) so secure cookies work.
  const expressApp = app.getHttpAdapter().getInstance() as import('express').Application;
  expressApp.set('trust proxy', 1);
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.use(helmet());

  const PgSession = connectPgSimple(session) as unknown as {
    new (options: connectPgSimple.PGStoreOptions): SessionStore;
  };
  const store: SessionStore | undefined =
    databaseUrl != null
      ? new PgSession({
          conString: databaseUrl,
          tableName: 'session',
          createTableIfMissing: true,
        })
      : undefined;

  app.use(
    session({
      store,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: isProd ? 'none' : 'lax',
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 8, // 8 hours
      },
    }),
  );
  // Initialize Passport for OAuth strategies and session persistence.
  app.use(passport.initialize());
  app.use(passport.session());

  // CSRF protection for state-changing requests; uses double-submit header `x-csrf-token`.
  const csrfProtection = csrf({
    cookie: false,
    value: (req: Request) => req.headers['x-csrf-token'] as string,
  }) as unknown as RequestHandler;
  app.use(csrfProtection);
  // Expose a fresh CSRF token on every response so the frontend can echo it back on state-changing requests.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const tokenFn = (req as unknown as { csrfToken?: () => string }).csrfToken;
    if (typeof tokenFn === 'function') {
      res.setHeader('x-csrf-token', tokenFn());
    }
    next();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ScholarXP API')
    .setDescription('ScholarXP backend API')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();
  await app.listen(3000);
}
void bootstrap();
