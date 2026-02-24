import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import session, { type Store as SessionStore } from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { FRONTEND_URL } from '@scholarxp/constants';
import { SafeExceptionFilter } from './common/filters/safe-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import {
  csrfSynchronisedProtection,
  generateToken,
} from './common/security/csrf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const csrfLogger = new Logger('CsrfMiddleware');
  const config = app.get(ConfigService);
  const requestIdMiddleware = new RequestIdMiddleware();
  const isProd =
    (config.get<string>('NODE_ENV') ?? 'development') === 'production';
  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? FRONTEND_URL;
  // Fail fast when the signing key is missing so we never run with an insecure default.
  const sessionSecret = config.getOrThrow<string>('SESSION_SECRET');
  const databaseUrl = config.get<string>('DATABASE_URL');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // Assign a request id before controllers run so logs and error payloads can be correlated.
  app.use((req: Request, res: Response, next: NextFunction) =>
    requestIdMiddleware.use(req, res, next),
  );
  // Central request lifecycle logs provide baseline observability without repeating code in handlers.
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  // Standardize outward-facing errors and keep internal details in server logs.
  app.useGlobalFilters(new SafeExceptionFilter());
  // Required when running behind a proxy (Heroku/Render/NGINX) so secure cookies work.
  const expressApp = app
    .getHttpAdapter()
    .getInstance() as import('express').Application;
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
  // We keep the explicit wrapper to log decisions and to skip validation for logout while still
  // issuing a fresh token for the next session bootstrap.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const shouldLogCsrf = req.path.startsWith('/auth');
    const sessionId = (req as unknown as { sessionID?: string }).sessionID;

    if (shouldLogCsrf) {
      csrfLogger.log(
        `Applying CSRF ${req.method} ${req.path} session=${sessionId ?? 'none'} header=${maskToken(req.headers['x-csrf-token'])}`,
      );
    }

    return csrfSynchronisedProtection(req, res, (err?: unknown) => {
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
    const shouldLogCsrf = req.path.startsWith('/auth');
    const sessionId = (req as unknown as { sessionID?: string }).sessionID;
    try {
      const nextToken = generateToken(req);
      res.setHeader('x-csrf-token', nextToken);
      if (shouldLogCsrf) {
        csrfLogger.log(
          `Issued CSRF token for ${req.method} ${req.path} session=${sessionId ?? 'none'} token=${maskToken(nextToken)}`,
        );
      }
    } catch (err) {
      if (shouldLogCsrf) {
        csrfLogger.warn(
          `Failed to issue CSRF token for ${req.method} ${req.path} session=${sessionId ?? 'none'} reason=${(err as Error).message ?? err}`,
        );
      }
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
