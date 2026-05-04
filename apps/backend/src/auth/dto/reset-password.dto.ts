// ResetPasswordDto validates the reset link token + new-password payload; mirrors register password rules.
import { IsString, Length, Matches, MinLength } from 'class-validator';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MIN_LENGTH,
} from '@scholarxp/constants';
import { ResetPasswordPayload } from '@scholarxp/api-contracts';

export class ResetPasswordDto implements ResetPasswordPayload {
  // URL-style tokens are 64-char hex strings (32 random bytes); bound length to keep payloads small.
  @IsString()
  @Length(16, 128)
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_REGEX, {
    message: PASSWORD_COMPLEXITY_MESSAGE,
  })
  password: string;
}
