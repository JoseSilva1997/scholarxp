// VerifyEmailDto carries the token needed to confirm a user's email address.
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(16, 128)
  token: string;
}
