import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateQuestionVariantDto {
  @IsInt()
  @IsNotEmpty()
  questionUnitId: number;

  @IsInt()
  @IsNotEmpty()
  contentId: number;

  @IsString()
  @IsNotEmpty()
  variantLabel: string;
}
