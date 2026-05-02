// Input shape for creating a practice session. Date fields are ISO strings here;
// PracticeSessionService converts them to Date objects before persisting.
import { IsDateString, IsInt, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePracticeSessionDto {
  @IsInt()
  @IsNotEmpty()
  moduleId: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsOptional()
  endTime?: string | null;
}
