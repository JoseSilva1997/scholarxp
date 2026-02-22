// AuthModule wires authentication: Passport session support, strategies, guards, and the controller.
// We keep concerns separated so strategies stay thin, guards reusable, and services own business logic.
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { MailerModule } from '../mailer/mailer.module';
import { EmailVerificationTokenModule } from '../db-entities/email-verification-token/email-verification-token.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { SessionSerializer } from './session.serializer';
import { RolesGuard } from './guards/roles.guard';
import { ModuleAccessGuard } from './guards/module-access.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { AuthorizationService } from './authorization/authorization.service';
import { AuthorizationGuard } from './guards/authorization.guard';

@Module({
  imports: [
    PrismaModule,
    MailerModule,
    EmailVerificationTokenModule,
    PassportModule.register({ session: true }),
    // Throttle auth endpoints to slow brute force attempts; kept local to this module.
    ThrottlerModule.forRoot([{ ttl: 60, limit: 10 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    GoogleStrategy,
    SessionSerializer,
    SessionAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
    AuthorizationService,
    AuthorizationGuard,
  ],
  exports: [
    AuthService,
    SessionAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
    AuthorizationService,
    AuthorizationGuard,
  ],
})
export class AuthModule {}
