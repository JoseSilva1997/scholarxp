// Input shape for creating a new progress record for a student on a module unit.
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class CreateModuleUnitUserProgressDto {
  @IsInt()
  @IsNotEmpty()
  moduleUnitId: number;

  @IsInt()
  @IsNotEmpty()
  studentId: number;

  @IsNumber()
  @IsNotEmpty()
  currentMasteryScore: number;

  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @IsInt()
  @IsNotEmpty()
  noOfCorrectAnswers: number;

  @IsOptional()
  completedAt?: Date | null;

  @IsOptional()
  lastPracticedAt?: Date | null;
}
