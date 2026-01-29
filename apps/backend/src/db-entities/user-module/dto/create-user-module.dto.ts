import { EnrollmentSource } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserModuleDto {
  @IsInt()
  @IsNotEmpty()
  moduleId: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  roleInModule: string;

  @IsInt()
  @IsNotEmpty()
  userModuleLevel: number;

  @IsInt()
  @IsNotEmpty()
  currentExp: number;

  @IsEnum(EnrollmentSource)
  @IsOptional()
  enrolledVia?: EnrollmentSource;
}
