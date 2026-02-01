// ResendVerificationDto validates email input for resending verification codes.
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  email: string;
}
