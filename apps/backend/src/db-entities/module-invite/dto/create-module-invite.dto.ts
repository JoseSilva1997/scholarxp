import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateInvitePayload } from '@scholarxp/api-contracts';

export class CreateModuleInviteDto implements CreateInvitePayload {
  // Allow instructors to override the default expiry window; validated in hours to keep inputs simple.
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInHours?: number;

  // Permit a custom usage cap when instructors want tighter control than the default ceiling.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}
