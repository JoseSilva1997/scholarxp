// NestJS module for email verification token management. No HTTP controller is exposed;
// token operations are invoked internally by AuthService to minimise the public API surface.
import { Module } from '@nestjs/common';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  // No HTTP controller exported: token issuance/consumption happen via internal
  // services (e.g., AuthService) to keep routes minimal and avoid public
  // surface area. Controller removed as unused.
  providers: [EmailVerificationTokenService],
  exports: [EmailVerificationTokenService],
})
export class EmailVerificationTokenModule {}
