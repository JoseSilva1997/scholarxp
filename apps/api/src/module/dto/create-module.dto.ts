import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModuleDto {
  @IsInt()
  @IsNotEmpty()
  institutionId: number;

  @IsString()
  @IsNotEmpty()
  ltiContextId: string;

  @IsString()
  @IsNotEmpty()
  resourceLinkId: string;

  @IsString()
  @IsNotEmpty()
  variantContext: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}
