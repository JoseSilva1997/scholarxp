// VerifyEmailDto carries the token needed to confirm a user's email address.
// Tokens are short numeric codes sent by email, so we enforce exactly six digits to align with issuer logic.
import { IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Matches(/^\d{6}$/)
  token: string;
}
