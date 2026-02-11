// Mapper for turning raw practice-room query results into stable API payloads while keeping services orchestration-focused.
import { Injectable } from '@nestjs/common';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';
import type { StudentAnswer } from '@scholarxp/api-contracts';
import { ModuleUnitPracticeRoomResponseDto } from './dto/practice-room-response.dto';
import type {
  LatestAttemptSnapshot,
  LoadedModuleUnit,
  RoomQuestionUnitDraft,
} from './practice-room.types';

type BuildResponseInput = {
  sessionId: number;
  moduleUnitId: number;
  moduleUnitTitle: string;
  questionUnitDrafts: RoomQuestionUnitDraft[];
  latestAttemptByKey: Map<string, LatestAttemptSnapshot>;
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
          variantContentIds: questionUnit.variants.map(
            (variant) => variant.contentId,
          ),
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
          variants: questionUnit.variants.map((variant) => ({
            questionId: questionUnit.id,
            questionContent: {
              id: variant.content.id,
              type: variant.content.type as questionType,
              questionStem: variant.content.questionStem,
              questionData: variant.content.questionData as QuestionData,
              hint: variant.content.hint,
              difficultyScore: variant.content.difficultyScore,
            },
          })),
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
      questions: input.questionUnitDrafts.map((questionUnitDraft, index) =>
        this.mapQuestionUnitForResponse(
          questionUnitDraft,
          index,
          input.latestAttemptByKey,
        ),
      ),
    };
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

    const mappedVariants = questionUnitDraft.variants.map((variant) => {
      const variantAttempt = latestAttemptByKey.get(
        this.buildAttemptKey(
          questionUnitDraft.questionUnitId,
          variant.questionContent.id,
        ),
      );
      return {
        questionId: variant.questionId,
        questionContent: variant.questionContent,
        lastAttempt: this.mapAttempt(variantAttempt),
      };
    });

    const hasCorrectAttempt =
      coreAttempt?.isCorrect === true ||
      mappedVariants.some((variant) => variant.lastAttempt?.isCorrect === true)
        ? true
        : null;

    return {
      questionUnitId: questionUnitDraft.questionUnitId,
      position: index + 1,
      hasCorrectAttempt,
      coreQuestion: {
        questionId: questionUnitDraft.coreQuestion.questionId,
        questionContent: questionUnitDraft.coreQuestion.questionContent,
        lastAttempt: this.mapAttempt(coreAttempt),
      },
      variants: mappedVariants,
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
