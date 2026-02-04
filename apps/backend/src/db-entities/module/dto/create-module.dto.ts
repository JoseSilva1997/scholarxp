import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CreateModulePayload } from '@scholarxp/api-contracts';

export class CreateModuleDto implements CreateModulePayload {
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
  @IsOptional()
  @MaxLength(255)
  variantContext?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  title: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsInt()
  @IsOptional()
  createdByUserId?: number;
}
