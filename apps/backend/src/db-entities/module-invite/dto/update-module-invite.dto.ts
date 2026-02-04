import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { UpdateInvitePayload } from '@scholarxp/api-contracts';

export class UpdateModuleInviteDto implements UpdateInvitePayload {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  // Indicates a soft revoke; we toggle revokedAt in the service to retain auditability.
  @IsOptional()
  @IsBoolean()
  revoke?: boolean;
}
