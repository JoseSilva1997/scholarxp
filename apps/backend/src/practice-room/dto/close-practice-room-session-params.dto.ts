// DTO role: validates close-session route params as one object so global whitelisting accepts sessionId.
import { IsUUID } from 'class-validator';
import { GetPracticeRoomParamsDto } from './get-practice-room-params.dto';

export class ClosePracticeRoomSessionParamsDto extends GetPracticeRoomParamsDto {
  // Keeping sessionId in the DTO avoids ValidationPipe rejecting it as a non-whitelisted route param.
  @IsUUID()
  sessionId!: string;
}
