// DTO for creating module unit question groups; implements shared contract to keep frontend/backed in sync.
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { CreateModuleUnitQuestionGroupPayload } from '@scholarxp/api-contracts';

export class CreateModuleUnitQuestionGroupDto implements CreateModuleUnitQuestionGroupPayload {
  @IsInt()
  @IsNotEmpty()
  moduleUnitId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsNotEmpty()
  sortOrder: number;
}
