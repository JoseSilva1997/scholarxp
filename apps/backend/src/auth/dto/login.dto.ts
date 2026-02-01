// LoginDto validates local login input; email is normalized to lowercase.
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
