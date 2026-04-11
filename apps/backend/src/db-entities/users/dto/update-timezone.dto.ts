// Validates incoming timezone updates; rejects non-IANA strings before they reach the DB.
import { IsTimeZone } from 'class-validator';
import type { UpdateTimezonePayload } from '@scholarxp/api-contracts';

export class UpdateTimezoneDto implements UpdateTimezonePayload {
  @IsTimeZone()
  timezone: string;
}
