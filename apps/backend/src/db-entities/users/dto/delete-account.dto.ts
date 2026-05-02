// Payload for the self-service account deletion endpoint. Requiring the user to confirm their email
// acts as a lightweight "are you sure?" guard against accidental or CSRF-driven deletions.
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
