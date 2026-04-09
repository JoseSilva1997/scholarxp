// Response DTO for the lesson drilldown endpoint; shape is dictated by LessonDrilldownResponse in api-contracts.
import type {
  LessonDrilldownResponse,
  LessonDrilldownStudentRow,
  QuestionAccuracySummary,
  QuestionVariantDiscrepancy,
  SlowQuestionRow,
  HighHintUsageRow,
} from '@scholarxp/api-contracts';

export class LessonDrilldownResponseDto implements LessonDrilldownResponse {
  moduleUnitId: number;
  lessonTitle: string;
  students: LessonDrilldownStudentRow[];
  questionHealth: {
    strugglingQuestions: QuestionAccuracySummary[];
    variantDiscrepancies: QuestionVariantDiscrepancy[];
    highHintUsage: HighHintUsageRow[];
    slowQuestions: SlowQuestionRow[];
  };
}
