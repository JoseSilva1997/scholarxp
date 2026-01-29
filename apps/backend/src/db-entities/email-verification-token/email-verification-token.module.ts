import { Module } from '@nestjs/common';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { EmailVerificationTokenController } from './email-verification-token.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmailVerificationTokenController],
  providers: [EmailVerificationTokenService],
  exports: [EmailVerificationTokenService],
})
export class EmailVerificationTokenModule {}
