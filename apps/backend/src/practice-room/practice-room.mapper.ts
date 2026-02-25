// Mapper for turning raw practice-room query results into stable API payloads while keeping services orchestration-focused.
import { Injectable } from '@nestjs/common';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';
import type { StudentAnswer, ModuleSummaryResponse } from '@scholarxp/api-contracts';
import { ModuleUnitPracticeRoomResponseDto } from './dto/practice-room-response.dto';
import type {
  LatestAttemptSnapshot,
  LoadedModuleUnit,
  RoomQuestionUnitDraft,
} from './practice-room.types';

type BuildResponseInput = {
  sessionId: string;
  moduleUnitId: number;
  moduleUnitTitle: string;
  isReadOnly: boolean;
  questionUnitDrafts: RoomQuestionUnitDraft[];
  latestAttemptByKey: Map<string, LatestAttemptSnapshot>;
  moduleProgress?: ModuleSummaryResponse;
};

@Injectable()
export class PracticeRoomMapper {
  // Converts DB rows to normalized question-unit drafts and omits units that have no core content.
  toQuestionUnitDrafts(moduleUnit: LoadedModuleUnit): RoomQuestionUnitDraft[] {
    return moduleUnit.questionUnits
      .map((questionUnit) => {
        const coreContent = questionUnit.contents.find(
          (content) => content.isCore,
        );
        if (!coreContent) {
          return null;
        }

        return {
          questionUnitId: questionUnit.id,
          coreContentId: coreContent.id,
          coreQuestion: {
            questionId: questionUnit.id,
            questionContent: {
              id: coreContent.id,
              type: coreContent.type as questionType,
              questionStem: coreContent.questionStem,
              questionData: coreContent.questionData as QuestionData,
              hint: coreContent.hint,
              difficultyScore: coreContent.difficultyScore,
            },
          },
        };
      })
      .filter((questionUnit) => questionUnit !== null);
  }

  // Keeps only the newest attempt per question/content pair to avoid duplicate history in page-load payloads.
  toLatestAttemptMap(
    attempts: LatestAttemptSnapshot[],
  ): Map<string, LatestAttemptSnapshot> {
    const latestAttemptByKey = new Map<string, LatestAttemptSnapshot>();
    for (const attempt of attempts) {
      const key = this.buildAttemptKey(attempt.questionId, attempt.contentId);
      if (!latestAttemptByKey.has(key)) {
        latestAttemptByKey.set(key, attempt);
      }
    }
    return latestAttemptByKey;
  }

  // Builds the API response in one place so contract changes stay isolated to this mapper.
  buildResponse(input: BuildResponseInput): ModuleUnitPracticeRoomResponseDto {
    const response = new ModuleUnitPracticeRoomResponseDto();
    response.practiceRoom = {
      sessionId: input.sessionId,
      moduleUnitId: input.moduleUnitId,
      moduleUnitTitle: input.moduleUnitTitle,
      isReadOnly: input.isReadOnly,
      questions: input.questionUnitDrafts.map((questionUnitDraft, index) =>
        this.mapQuestionUnitForResponse(
          questionUnitDraft,
          index,
          input.latestAttemptByKey,
        ),
      ),
    };
    response.moduleProgress = input.moduleProgress;
    return response;
  }

  // Stable composite key format lets data-fetch and mapping layers coordinate attempt lookups consistently.
  buildAttemptKey(questionId: number, contentId: number): string {
    return `${questionId}:${contentId}`;
  }

  // Maps one question unit from normalized draft state into the shared API response shape.
  private mapQuestionUnitForResponse(
    questionUnitDraft: RoomQuestionUnitDraft,
    index: number,
    latestAttemptByKey: Map<string, LatestAttemptSnapshot>,
  ) {
    const coreAttempt = latestAttemptByKey.get(
      this.buildAttemptKey(
        questionUnitDraft.questionUnitId,
        questionUnitDraft.coreContentId,
      ),
    );

    // Core-only mode: question-unit solved state is driven exclusively by the core question latest attempt.
    const hasCorrectAttempt = coreAttempt?.isCorrect === true ? true : null;

    return {
      questionUnitId: questionUnitDraft.questionUnitId,
      position: index + 1,
      hasCorrectAttempt,
      coreQuestion: {
        questionId: questionUnitDraft.coreQuestion.questionId,
        questionContent: questionUnitDraft.coreQuestion.questionContent,
        lastAttempt: this.mapAttempt(coreAttempt),
      },
    };
  }

  // Centralizing attempt serialization preserves a single null/ISO-date rule across core and variant responses.
  private mapAttempt(attempt: LatestAttemptSnapshot | undefined) {
    if (!attempt) {
      return null;
    }
    return {
      studentAnswer: attempt.studentAnswer as unknown as StudentAnswer,
      isCorrect: attempt.isCorrect,
    };
  }
}
