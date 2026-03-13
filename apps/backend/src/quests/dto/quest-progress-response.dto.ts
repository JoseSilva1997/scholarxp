// DTO aligns quest progress trigger responses with the shared API contract used by frontend mutations.
import type { QuestProgressResponse } from '@scholarxp/api-contracts';

export class QuestProgressResponseDto implements QuestProgressResponse {
  // The boolean keeps mutation callers simple while still giving apiFetch a stable JSON response body.
  recorded!: boolean;
}
