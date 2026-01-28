import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { CreateEmailVerificationTokenDto } from './dto/create-email-verification-token.dto';

@Controller('email-verification-token')
export class EmailVerificationTokenController {
  constructor(
    private readonly emailVerificationTokenService: EmailVerificationTokenService,
  ) {}

  @Post()
  create(
    @Body() createEmailVerificationTokenDto: CreateEmailVerificationTokenDto,
  ) {
    return this.emailVerificationTokenService.issueToken({
      userId: createEmailVerificationTokenDto.userId,
      reason: createEmailVerificationTokenDto.reason,
      ttlMinutes: createEmailVerificationTokenDto.ttlMinutes,
      reuseExisting: createEmailVerificationTokenDto.reuseActive,
    });
  }

  @Post('consume/:token')
  consume(@Param('token') token: string) {
    return this.emailVerificationTokenService.consumeToken(token);
  }

  @Delete('expired')
  pruneExpired() {
    return this.emailVerificationTokenService.pruneExpired();
  }
}
