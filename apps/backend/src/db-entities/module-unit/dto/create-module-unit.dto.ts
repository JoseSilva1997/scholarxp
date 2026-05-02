// Full creation payload for admin/internal use. The minimal counterpart (CreateModuleUnitMinimalDto)
// is used by the authoring UI where status and ordering are set by the server.
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
