import { InviteType } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateModuleInviteDto {
  @IsInt()
  @IsNotEmpty()
  moduleId: number;

  @IsInt()
  @IsNotEmpty()
  createdByUserId: number;

  @IsEnum(InviteType)
  type: InviteType;

  @IsString()
  @IsNotEmpty()
  tokenHash: string;

  @IsEmail()
  @IsOptional()
  emailLock?: string;

  @IsInt()
  @IsOptional()
  maxUses?: number;

  @IsInt()
  @IsOptional()
  uses?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsDateString()
  @IsOptional()
  revokedAt?: string;
}
