import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ModuleUnitStatus } from '@prisma/client';
import { CreateModuleUnitPayload } from '@scholarxp/api-contracts';

export class CreateModuleUnitDto implements CreateModuleUnitPayload {
  @IsInt()
  @IsNotEmpty()
  moduleId: number;

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
