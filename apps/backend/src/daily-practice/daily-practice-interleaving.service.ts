// Role: orders selected daily-practice questions so the final set alternates lessons when possible without sacrificing deterministic behavior.
import { Injectable } from '@nestjs/common';
import type {
  OrderedDailyPracticeQuestionRecord,
  SelectedDailyPracticeQuestionRecord,
} from './daily-practice.types';

type QueuedSelectedQuestion = {
  originalIndex: number;
  question: SelectedDailyPracticeQuestionRecord;
};

type LessonQueue = {
  moduleUnitId: number;
  moduleUnitSortOrder: number;
  queuedQuestions: QueuedSelectedQuestion[];
};

@Injectable()
export class DailyPracticeInterleavingService {
  // The interleaver keeps each lesson's local order stable while weaving lessons together to create product-level variety.
  orderSelectedQuestions(
    selectedQuestions: SelectedDailyPracticeQuestionRecord[],
  ): OrderedDailyPracticeQuestionRecord[] {
    if (selectedQuestions.length === 0) {
      return [];
    }

    const lessonQueues = this.buildLessonQueues(selectedQuestions);
    const orderedQuestions: OrderedDailyPracticeQuestionRecord[] = [];
    let previousModuleUnitId: number | null = null;

    while (
      lessonQueues.some((lessonQueue) => lessonQueue.queuedQuestions.length > 0)
    ) {
      const nextLessonQueue = this.selectNextLessonQueue(
        lessonQueues,
        previousModuleUnitId,
      );

      if (!nextLessonQueue) {
        break;
      }

      const nextQueuedQuestion = nextLessonQueue.queuedQuestions.shift();
      if (!nextQueuedQuestion) {
        continue;
      }

      orderedQuestions.push({
        ...nextQueuedQuestion.question,
        position: orderedQuestions.length,
      });
      previousModuleUnitId = nextLessonQueue.moduleUnitId;
    }

    return orderedQuestions;
  }

  private buildLessonQueues(
    selectedQuestions: SelectedDailyPracticeQuestionRecord[],
  ): LessonQueue[] {
    const lessonQueueByModuleUnitId = new Map<number, LessonQueue>();

    for (const [originalIndex, question] of selectedQuestions.entries()) {
      const existingQueue = lessonQueueByModuleUnitId.get(
        question.moduleUnitId,
      );
      if (existingQueue) {
        existingQueue.queuedQuestions.push({
          originalIndex,
          question,
        });
        continue;
      }

      lessonQueueByModuleUnitId.set(question.moduleUnitId, {
        moduleUnitId: question.moduleUnitId,
        moduleUnitSortOrder: question.moduleUnitSortOrder,
        queuedQuestions: [
          {
            originalIndex,
            question,
          },
        ],
      });
    }

    return Array.from(lessonQueueByModuleUnitId.values()).sort(
      (left, right) => {
        return (
          left.moduleUnitSortOrder - right.moduleUnitSortOrder ||
          left.moduleUnitId - right.moduleUnitId
        );
      },
    );
  }

  private selectNextLessonQueue(
    lessonQueues: LessonQueue[],
    previousModuleUnitId: number | null,
  ): LessonQueue | null {
    const nonEmptyLessonQueues = lessonQueues.filter(
      (lessonQueue) => lessonQueue.queuedQuestions.length > 0,
    );
    if (nonEmptyLessonQueues.length === 0) {
      return null;
    }

    const eligibleLessonQueues = nonEmptyLessonQueues.filter(
      (lessonQueue) => lessonQueue.moduleUnitId !== previousModuleUnitId,
    );

    const poolToRank =
      eligibleLessonQueues.length > 0
        ? eligibleLessonQueues
        : nonEmptyLessonQueues;

    return poolToRank.sort((left, right) => {
      return (
        right.queuedQuestions.length - left.queuedQuestions.length ||
        left.queuedQuestions[0].originalIndex -
          right.queuedQuestions[0].originalIndex ||
        left.moduleUnitSortOrder - right.moduleUnitSortOrder ||
        left.moduleUnitId - right.moduleUnitId
      );
    })[0];
  }
}
