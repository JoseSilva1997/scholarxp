import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleStrategy } from './google.strategy';
import { EmailVerificationTokenModule } from '../email-verification-token/email-verification-token.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [PrismaModule, EmailVerificationTokenModule, MailerModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
