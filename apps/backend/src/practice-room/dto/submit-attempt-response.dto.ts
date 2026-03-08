// Shapes submit-attempt responses so backend output stays contract-synchronized with frontend consumers.
import type {
  Awards,
  SubmitAttemptResponse,
  ModuleSummaryResponse,
} from '@scholarxp/api-contracts';

export class SubmitAttemptResponseDto implements SubmitAttemptResponse {
  awards: Awards;
  hasCorrectAttempt: boolean;
  updatedModuleProgress?: ModuleSummaryResponse;
  // Live session streak relayed from ExpStreakService after each submission.
  currentStreak?: number;
}
