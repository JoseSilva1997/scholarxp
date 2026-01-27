import { GlobalRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  lastName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  globalRole?: GlobalRole;
}
