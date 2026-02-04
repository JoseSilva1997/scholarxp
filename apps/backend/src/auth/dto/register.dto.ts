// RegisterDto validates and normalizes user signup input for local auth.
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  NAME_MAX_LENGTH,
  NAME_REGEX,
  NAME_REGEX_MESSAGE,
} from '@scholarxp/constants';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MIN_LENGTH,
} from '@scholarxp/constants';
import { RegisterPayload } from '@scholarxp/api-contracts';

export class RegisterDto implements RegisterPayload {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_REGEX, { message: NAME_REGEX_MESSAGE })
  firstName: string;

  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_REGEX, { message: NAME_REGEX_MESSAGE })
  lastName: string;

  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_REGEX, {
    message: PASSWORD_COMPLEXITY_MESSAGE,
  })
  password: string;
}
