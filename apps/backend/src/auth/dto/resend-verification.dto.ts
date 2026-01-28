// DTO for requesting another verification code for a given email address.
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;
}
