import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModuleDto {
  @IsInt()
  @IsOptional()
  institutionId?: number;

  @IsString()
  @IsOptional()
  ltiContextId?: string;

  @IsString()
  @IsOptional()
  resourceLinkId?: string;

  @IsString()
  @IsNotEmpty()
  variantContext: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsInt()
  @IsOptional()
  createdByUserId?: number;
}
