// ForgotPasswordDto validates email input for the password-reset request flow.
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { ForgotPasswordPayload } from '@scholarxp/api-contracts';

export class ForgotPasswordDto implements ForgotPasswordPayload {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  email: string;
}
