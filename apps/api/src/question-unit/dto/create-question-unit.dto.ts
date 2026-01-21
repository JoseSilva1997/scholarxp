import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateQuestionUnitDto {
  @IsInt()
  @IsNotEmpty()
  coreQuestionId: number;

  @IsInt()
  @IsNotEmpty()
  moduleUnitId: number;

  @IsInt()
  @IsNotEmpty()
  questionGroupId: number;

  @IsString()
  @IsNotEmpty()
  title: string;
}
