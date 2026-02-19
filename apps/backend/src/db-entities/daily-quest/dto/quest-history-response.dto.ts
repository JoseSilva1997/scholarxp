// DTOs that implement shared quest-history contracts so backend responses stay compile-time aligned with frontend expectations.
import type {
  QuestHistoryResponse,
  QuestType,
  QuestView,
} from '@scholarxp/api-contracts';

export class QuestHistoryItemDto implements QuestView {
  id: number;
  moduleId: number;
  moduleUnitId: number | null;
  moduleTitle: string;
  moduleUnitTitle: string | null;
  type: QuestType;
  expGranted: number;
  isCompleted: boolean;
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
