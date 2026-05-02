// All fields become optional; typically used to set endTime when a session is completed.
import { PartialType } from '@nestjs/mapped-types';
import { CreatePracticeSessionDto } from './create-practice-session.dto';

export class UpdatePracticeSessionDto extends PartialType(
  CreatePracticeSessionDto,
) {}
