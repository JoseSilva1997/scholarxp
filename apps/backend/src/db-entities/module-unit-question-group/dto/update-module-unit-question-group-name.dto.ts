// DTO for renaming a question group through scoped module/unit routes while keeping payload minimal.
import { IsNotEmpty, IsString } from 'class-validator';
import { UpdateModuleUnitQuestionGroupNamePayload } from '@scholarxp/api-contracts';

export class UpdateModuleUnitQuestionGroupNameDto
  implements UpdateModuleUnitQuestionGroupNamePayload
{
  // Restrict update payload to name so clients cannot mutate ownership or ordering by mistake.
  @IsString()
  @IsNotEmpty()
  name: string;
}
