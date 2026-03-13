// DTOs that implement shared quest-history contracts so backend responses stay compile-time aligned with frontend expectations.
import type {
  QuestHistoryResponse,
  QuestTier,
  QuestType,
  QuestView,
} from '@scholarxp/api-contracts';

export class QuestHistoryItemDto implements QuestView {
  id: number;
  moduleId: number | null;
  moduleUnitId: number | null;
  moduleTitle: string | null;
  moduleUnitTitle: string | null;
  type: QuestType;
  tier: QuestTier;
  expGranted: number;
  isCompleted: boolean;
  progressCurrent: number;
  progressTarget: number;
  questDateUtc: string;
  generatedAt: string;
  completedAt: string | null;
  description: string;
}

export class QuestHistoryResponseDto implements QuestHistoryResponse {
  quests: QuestHistoryItemDto[];
  hasMore: boolean;
  nextDayOffset: number | null;
}
