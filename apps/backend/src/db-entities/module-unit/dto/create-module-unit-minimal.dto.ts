// DTO for module-scoped creation; server fills defaults to keep clients simple.
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateModuleUnitMinimalDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
