// Low-level DTO for creating a variant record that links a label to an existing content row.
// Prefer CreateVariantWithContentDto which creates the content row and variant atomically.
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
