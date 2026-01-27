import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import session from 'express-session';
import passport from 'passport';
import { AppModule } from './app.module';
import { FRONTEND_URL } from './constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProd = process.env.NODE_ENV === 'production';
  const corsOrigin = process.env.CORS_ORIGIN ?? FRONTEND_URL;
  const sessionSecret = process.env.SESSION_SECRET ?? 'dev-session-secret';

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: isProd ? 'none' : 'lax',
        secure: isProd,
      },
    }),
  );
  // Initialize Passport for OAuth strategies; session is handled manually via req.session.
  app.use(passport.initialize());

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
bootstrap();
