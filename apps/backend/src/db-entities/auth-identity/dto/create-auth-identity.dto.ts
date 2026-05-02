// Input shape for creating a new auth identity; validates that all required OAuth/local fields are present.
import { AuthProvider } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAuthIdentityDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @IsString()
  @IsNotEmpty()
  providerUserId: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
