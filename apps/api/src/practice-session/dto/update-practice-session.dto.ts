import { PartialType } from '@nestjs/mapped-types';
import { CreatePracticeSessionDto } from './create-practice-session.dto';

export class UpdatePracticeSessionDto extends PartialType(CreatePracticeSessionDto) {}
