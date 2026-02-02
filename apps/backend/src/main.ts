import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
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
  const csrfLogger = new Logger('CsrfMiddleware');
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
    // Expose CSRF + tracing headers so the SPA can read and cache them.
    exposedHeaders: ['x-csrf-token', 'x-request-id'],
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

  // Helper to avoid logging entire tokens while still correlating requests.
  const maskToken = (token: string | string[] | undefined): string => {
    if (!token) {
      return 'none';
    }
    const value = Array.isArray(token) ? token[0] : token;
    return `${value.slice(0, 8)}...len=${value.length}`;
  };

  // CSRF protection for state-changing requests; uses double-submit header `x-csrf-token`.
  const csrfProtection = csrf({
    cookie: false,
    value: (req: Request) => req.headers['x-csrf-token'] as string,
  }) as unknown as RequestHandler;
  // For logout we want to skip validation but still seed a fresh token for the next session.
  const csrfSeedOnly = csrf({
    cookie: false,
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
  }) as unknown as RequestHandler;
  // Skip CSRF for logout to avoid double-destroy race; all other state-changing routes are protected.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const shouldLogCsrf = req.path.startsWith('/auth');
    const sessionId = (req as unknown as { sessionID?: string }).sessionID;
    if (req.path === '/auth/logout' && req.method === 'POST') {
      return csrfSeedOnly(req, res, (err?: unknown) => {
        if (err) {
          if (shouldLogCsrf) {
            csrfLogger.warn(
              `Logout CSRF seed failed session=${sessionId ?? 'none'} reason=${(err as Error).message ?? err}`,
            );
          }
          return next(err);
        }
        if (shouldLogCsrf) {
          csrfLogger.log(
            `Seeded CSRF for logout; session=${sessionId ?? 'none'} token=${maskToken(
              (req as unknown as { csrfToken?: () => string }).csrfToken?.(),
            )}`,
          );
        }
        return next();
      });
    }
    if (shouldLogCsrf) {
      csrfLogger.log(
        `Applying CSRF ${req.method} ${req.path} session=${sessionId ?? 'none'} header=${maskToken(req.headers['x-csrf-token'] as string | string[] | undefined)}`,
      );
    }
    return csrfProtection(req, res, (err?: unknown) => {
      if (err) {
        if (shouldLogCsrf) {
          csrfLogger.warn(
            `CSRF rejection ${req.method} ${req.path} session=${sessionId ?? 'none'} reason=${(err as Error).message ?? err}`,
          );
        }
        return next(err);
      }
      if (shouldLogCsrf) {
        csrfLogger.log(
          `CSRF accepted ${req.method} ${req.path} session=${sessionId ?? 'none'}`,
        );
      }
      return next();
    });
  });
// Expose a fresh CSRF token on every response so the frontend can echo it back on state-changing requests.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const tokenFn = (req as unknown as { csrfToken?: () => string }).csrfToken;
    const shouldLogCsrf = req.path.startsWith('/auth');
    const sessionId = (req as unknown as { sessionID?: string }).sessionID;
    if (typeof tokenFn === 'function') {
      const nextToken = tokenFn();
      res.setHeader('x-csrf-token', nextToken);
      if (shouldLogCsrf) {
        csrfLogger.log(
          `Issued CSRF token for ${req.method} ${req.path} session=${sessionId ?? 'none'} token=${maskToken(nextToken)}`,
        );
      }
    } else if (shouldLogCsrf) {
      csrfLogger.warn(
        `No csrfToken generator on ${req.method} ${req.path} session=${sessionId ?? 'none'}`,
      );
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
