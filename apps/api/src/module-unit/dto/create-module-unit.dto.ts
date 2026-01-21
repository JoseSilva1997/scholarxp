import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ModuleUnitStatus } from '@prisma/client';

export class CreateModuleUnitDto {
  @IsInt()
  @IsNotEmpty()
  moduleId: number;

  @IsString()
  @IsNotEmpty()
  variantContext: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsInt()
  @IsNotEmpty()
  questionCount: number;

  @IsEnum(ModuleUnitStatus)
  @IsNotEmpty()
  status: ModuleUnitStatus;

  @IsInt()
  @IsNotEmpty()
  sortOrder: number;
}
