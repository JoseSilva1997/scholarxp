// Validates self-service name updates so client cannot bypass create-time name rules through patch.
import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  NAME_MAX_LENGTH,
  NAME_REGEX,
  NAME_REGEX_MESSAGE,
} from '@scholarxp/constants';
import type { UpdateNamePayload } from '@scholarxp/api-contracts';

export class UpdateNameDto implements UpdateNamePayload {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_REGEX, { message: NAME_REGEX_MESSAGE })
  firstName: string;

  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_REGEX, { message: NAME_REGEX_MESSAGE })
  lastName: string;
}
