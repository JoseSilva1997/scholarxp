// Extends PartialType but explicitly redeclares fields with transformers because PartialType
// does not reliably copy class-transformer decorators, which are needed for trimming and normalisation.
import { PartialType } from '@nestjs/mapped-types';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  NAME_MAX_LENGTH,
  NAME_REGEX,
  NAME_REGEX_MESSAGE,
} from '@scholarxp/constants';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // Re-define email transformation because PartialType copies validators but not transformers reliably.
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  @IsOptional()
  email?: string;

  // Preserve name trimming and character rules on partial updates.
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @IsOptional()
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_REGEX, { message: NAME_REGEX_MESSAGE })
  firstName?: string;

  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @IsOptional()
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_REGEX, { message: NAME_REGEX_MESSAGE })
  lastName?: string;
}
