import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import type { DeleteAccountPayload } from '@scholarxp/api-contracts';

export class DeleteAccountDto implements DeleteAccountPayload {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  confirmEmail: string;
}
