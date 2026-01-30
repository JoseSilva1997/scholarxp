// DTO for redeeming an invite token; keeps payload tight and validates presence.
import { IsNotEmpty, IsString } from 'class-validator';

export class RedeemModuleInviteDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
