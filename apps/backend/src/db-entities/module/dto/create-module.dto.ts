// Input shape for creating a new module. createdByUserId is optional because the controller
// sets it from the authenticated session rather than accepting it from the client.
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CreateModulePayload } from '@scholarxp/api-contracts';

export class CreateModuleDto implements CreateModulePayload {
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
