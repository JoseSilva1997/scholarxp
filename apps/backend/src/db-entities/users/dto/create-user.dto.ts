// Input shape for creating a user account. Name fields are trimmed and validated against the shared
// NAME_REGEX to enforce consistent formatting. Email is normalised to lowercase at the transform boundary.
import { GlobalRole } from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  NAME_REGEX,
  NAME_REGEX_MESSAGE,
  NAME_MAX_LENGTH,
} from '@scholarxp/constants';

export class CreateUserDto {
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

  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  globalRole?: GlobalRole;
}
