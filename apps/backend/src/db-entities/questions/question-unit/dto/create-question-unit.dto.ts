// Low-level DTO for creating a bare question unit record. Prefer CreateQuestionWithContentDto
// for authoring flows that need to create the unit and its core content atomically.
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQuestionUnitDto {
  @IsInt()
  @IsOptional()
  moduleUnitId?: number;

  @IsInt()
  @IsOptional()
  questionGroupId?: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  sortOrder?: number;
}
