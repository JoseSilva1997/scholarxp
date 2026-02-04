// LoginDto validates local login input; email is normalized to lowercase.
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';
import { LoginPayload } from '@scholarxp/api-contracts';

export class LoginDto implements LoginPayload {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
