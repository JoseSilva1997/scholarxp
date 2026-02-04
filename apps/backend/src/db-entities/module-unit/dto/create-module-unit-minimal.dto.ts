// DTO for module-scoped creation; server fills defaults to keep clients simple.
import { IsNotEmpty, IsString } from 'class-validator';
import { CreateModuleUnitMinimalPayload } from '@scholarxp/api-contracts';

export class CreateModuleUnitMinimalDto implements CreateModuleUnitMinimalPayload {
  @IsString()
  @IsNotEmpty()
  title: string;
}
