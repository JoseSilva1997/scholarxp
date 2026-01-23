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
}
