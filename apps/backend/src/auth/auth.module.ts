import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleStrategy } from './google.strategy';
import { EmailVerificationTokenModule } from '../db-entities/email-verification-token/email-verification-token.module';
import { MailerModule } from '../mailer/mailer.module';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ModuleAccessGuard } from './guards/module-access.guard';

@Module({
  imports: [PrismaModule, EmailVerificationTokenModule, MailerModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    SessionAuthGuard,
    RolesGuard,
    ModuleAccessGuard,
  ],
  exports: [AuthService, SessionAuthGuard, RolesGuard, ModuleAccessGuard],
})
export class AuthModule {}
