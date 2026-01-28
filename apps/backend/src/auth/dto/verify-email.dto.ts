// DTO for verifying an email address using a one-time code issued during signup.
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(4, 64)
  token: string;
}
