// All fields from CreateEmailVerificationTokenDto become optional for partial updates.
import { PartialType } from '@nestjs/swagger';
import { CreateEmailVerificationTokenDto } from './create-email-verification-token.dto';

export class UpdateEmailVerificationTokenDto extends PartialType(
  CreateEmailVerificationTokenDto,
) {}
