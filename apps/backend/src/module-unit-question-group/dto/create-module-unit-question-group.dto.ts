import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateModuleUnitQuestionGroupDto {
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
