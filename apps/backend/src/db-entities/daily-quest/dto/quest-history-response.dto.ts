// DTOs that implement shared quest-history contracts so backend responses stay compile-time aligned with frontend expectations.
import type { Quest, QuestHistoryResponse, QuestType } from '@scholarxp/api-contracts';

export class QuestHistoryItemDto implements Quest {
  id: number;
  moduleId: number;
  moduleTitle: string;
  type: QuestType;
  expGranted: number;
  isCompleted: boolean;
  questDateUtc: string;
  generatedAt: string;
  completedAt: string | null;
}

export class QuestHistoryResponseDto implements QuestHistoryResponse {
  quests: QuestHistoryItemDto[];
  hasMore: boolean;
  nextDayOffset: number | null;
}
