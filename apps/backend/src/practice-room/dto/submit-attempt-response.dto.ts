// Shapes submit-attempt responses so backend output stays contract-synchronized with frontend consumers.
import type {
  SubmitAttemptResponse,
  ModuleSummaryResponse,
} from '@scholarxp/api-contracts';

export class SubmitAttemptResponseDto implements SubmitAttemptResponse {
  moduleExpAwarded: number;
  studentExpAwarded: number;
  hasCorrectAttempt: boolean;
  updatedModuleProgress?: ModuleSummaryResponse;
}
