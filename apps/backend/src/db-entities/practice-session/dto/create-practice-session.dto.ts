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
