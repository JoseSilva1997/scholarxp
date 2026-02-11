// Encapsulates practice-room route orchestration so the page component can stay presentational.
import { useEffect, useMemo, useState } from 'react';
import type {
  PracticeRoomAttempt,
  PracticeRoomResponse,
  PracticeRoomQuestion,
  PracticeRoomQuestionUnit,
  StudentAnswer,
  SubmitAttemptPayload,
} from '@scholarxp/api-contracts';
import { MODULE_EXP_MAX, PRACTICE_MODES } from '@scholarxp/constants';
import { getDisplayErrorMessage, shouldLogApiError } from '../../api/get-display-error';
import { logError } from '../../utils/logger';
import {
  usePracticeRoomQuery,
  useSubmitPracticeRoomAttemptMutation,
} from '../queries/usePracticeRoomQueries';
import { useModuleDetailQuery } from '../queries/useModulesQueries';

type UsePracticeRoomPageStateParams = {
  moduleIdParam: string | undefined;
  unitIdParam: string | undefined;
};

type ActiveQuestionVariant = {
  kind: 'core' | 'variant';
  index: number | null;
  question: PracticeRoomQuestion;
};

// Minimal question-data shape used to render selectable options in the current practice-room panel.
type QuestionDataWithOptions = {
  options: Array<{ optionText: string }>;
  trueOption?: { isCorrect: boolean; explanation?: string };
  falseOption?: { isCorrect: boolean; explanation?: string };
};

type ModuleProgress = {
  level: number;
  currentExp: number;
  expPercent: number;
};

type QuestionTrackNav = {
  activeLabel: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

type QuestionUnitNav = {
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export function usePracticeRoomPageState({
  moduleIdParam,
  unitIdParam,
}: UsePracticeRoomPageStateParams) {
  const parsedModuleId = useMemo(() => {
    if (!moduleIdParam) return null;
    const value = Number(moduleIdParam);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [moduleIdParam]);

  const parsedUnitId = useMemo(() => {
    if (!unitIdParam) return null;
    const value = Number(unitIdParam);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [unitIdParam]);

  const practiceRoomQuery = usePracticeRoomQuery(parsedModuleId, parsedUnitId);
  const submitAttemptMutation = useSubmitPracticeRoomAttemptMutation(
    parsedModuleId,
    parsedUnitId,
  );
  const moduleDetailQuery = useModuleDetailQuery(parsedModuleId);
  const room = practiceRoomQuery.data?.practiceRoom ?? null;
  const moduleDetail = moduleDetailQuery.data ?? null;

  const [selectedQuestionUnitIndex, setSelectedQuestionUnitIndex] = useState(0);
  const [selectedVariantIndexByUnit, setSelectedVariantIndexByUnit] = useState<
    Record<number, number | null>
  >({});
  const [selectedOptionOverrideByContentId, setSelectedOptionOverrideByContentId] = useState<
    Record<number, number>
  >({});
  const [unlockedHintByContentId, setUnlockedHintByContentId] = useState<
    Record<number, boolean>
  >({});
  const [submittedAttemptByContentId, setSubmittedAttemptByContentId] = useState<
    Record<number, PracticeRoomAttempt>
  >({});
  const [hasCorrectAttemptByQuestionUnitId, setHasCorrectAttemptByQuestionUnitId] =
    useState<Record<number, boolean>>({});
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!practiceRoomQuery.error) return;
    if (shouldLogApiError(practiceRoomQuery.error)) {
      logError(practiceRoomQuery.error, {
        feature: 'practice-room',
        action: 'load',
        moduleId: parsedModuleId,
        unitId: parsedUnitId,
      });
    }
  }, [parsedModuleId, parsedUnitId, practiceRoomQuery.error]);

  useEffect(() => {
    if (!moduleDetailQuery.error) return;
    if (shouldLogApiError(moduleDetailQuery.error)) {
      logError(moduleDetailQuery.error, {
        feature: 'practice-room',
        action: 'load-module-progress',
        moduleId: parsedModuleId,
      });
    }
  }, [moduleDetailQuery.error, parsedModuleId]);

  const roomWithLocalAttempts = useMemo(() => {
    if (!room) {
      return null;
    }

    return {
      ...room,
      questions: room.questions.map((questionUnit) =>
        applySubmittedAttemptOverrides(
          questionUnit,
          submittedAttemptByContentId,
          hasCorrectAttemptByQuestionUnitId[questionUnit.questionUnitId] ?? false,
        ),
      ),
    } satisfies PracticeRoomResponse['practiceRoom'];
  }, [hasCorrectAttemptByQuestionUnitId, room, submittedAttemptByContentId]);

  const seededOptionByContentId = useMemo(() => {
    if (!roomWithLocalAttempts) return {};

    // Seed option selections from latest attempts to preserve continuity when students re-enter a session.
    const seededSelection: Record<number, number> = {};
    for (const questionUnit of roomWithLocalAttempts.questions) {
      const coreAttemptSelection = readSelectedOptionIndex(
        questionUnit.coreQuestion.lastAttempt?.studentAnswer,
      );
      if (coreAttemptSelection !== null) {
        seededSelection[questionUnit.coreQuestion.questionContent.id] =
          coreAttemptSelection;
      }

      for (const variant of questionUnit.variants) {
        const variantAttemptSelection = readSelectedOptionIndex(
          variant.lastAttempt?.studentAnswer,
        );
        if (variantAttemptSelection !== null) {
          seededSelection[variant.questionContent.id] = variantAttemptSelection;
        }
      }
    }
    return seededSelection;
  }, [roomWithLocalAttempts]);

  const selectedOptionByContentId = useMemo(
    () => ({
      ...seededOptionByContentId,
      ...selectedOptionOverrideByContentId,
    }),
    [seededOptionByContentId, selectedOptionOverrideByContentId],
  );

  const activeQuestionUnit = useMemo<PracticeRoomQuestionUnit | null>(() => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return null;
    }
    const clampedSelectedIndex = Math.max(
      0,
      Math.min(
        selectedQuestionUnitIndex,
        roomWithLocalAttempts.questions.length - 1,
      ),
    );
    return (
      roomWithLocalAttempts.questions[clampedSelectedIndex] ??
      roomWithLocalAttempts.questions[0]
    );
  }, [roomWithLocalAttempts, selectedQuestionUnitIndex]);

  const activeQuestion = useMemo<ActiveQuestionVariant | null>(() => {
    if (!activeQuestionUnit) return null;
    const unlockedVariantCount = getUnlockedVariantCount(activeQuestionUnit);

    const selectedVariantIndex =
      selectedVariantIndexByUnit[activeQuestionUnit.questionUnitId] ?? null;
    if (
      selectedVariantIndex === null ||
      selectedVariantIndex < 0 ||
      selectedVariantIndex >= unlockedVariantCount
    ) {
      return {
        kind: 'core',
        index: null,
        question: activeQuestionUnit.coreQuestion.questionContent,
      };
    }

    const variant = activeQuestionUnit.variants[selectedVariantIndex];
    if (!variant) {
      return {
        kind: 'core',
        index: null,
        question: activeQuestionUnit.coreQuestion.questionContent,
      };
    }

    return {
      kind: 'variant',
      index: selectedVariantIndex,
      question: variant.questionContent,
    };
  }, [activeQuestionUnit, selectedVariantIndexByUnit]);

  const trackNav = useMemo<QuestionTrackNav>(() => {
    if (!activeQuestionUnit || !activeQuestion) {
      return {
        activeLabel: 'Core',
        canGoPrevious: false,
        canGoNext: false,
      };
    }

    const unlockedVariantCount = getUnlockedVariantCount(activeQuestionUnit);
    if (activeQuestion.kind === 'core') {
      return {
        activeLabel: 'Core',
        canGoPrevious: false,
        canGoNext: unlockedVariantCount > 0,
      };
    }

    return {
      activeLabel: `Variant ${activeQuestion.index! + 1}`,
      canGoPrevious: true,
      canGoNext: activeQuestion.index! < unlockedVariantCount - 1,
    };
  }, [activeQuestion, activeQuestionUnit]);

  const activeQuestionOptions = useMemo(() => {
    if (!activeQuestion) return [];
    return readQuestionOptions(activeQuestion.question.questionData);
  }, [activeQuestion]);

  const questionUnitNav = useMemo<QuestionUnitNav>(() => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return { canGoPrevious: false, canGoNext: false };
    }
    return {
      canGoPrevious: selectedQuestionUnitIndex > 0,
      canGoNext:
        selectedQuestionUnitIndex < roomWithLocalAttempts.questions.length - 1,
    };
  }, [roomWithLocalAttempts, selectedQuestionUnitIndex]);

  const pageError = useMemo(() => {
    if (!parsedModuleId || !parsedUnitId) {
      return 'Practice room not found. Please check the link and try again.';
    }
    if (moduleDetailQuery.error) {
      return getDisplayErrorMessage(moduleDetailQuery.error, {
        fallbackMessage: 'We could not load this practice room right now. Please try again.',
      });
    }
    if (practiceRoomQuery.error) {
      return getDisplayErrorMessage(practiceRoomQuery.error, {
        fallbackMessage: 'We could not load this practice room right now. Please try again.',
      });
    }
    return null;
  }, [moduleDetailQuery.error, parsedModuleId, parsedUnitId, practiceRoomQuery.error]);

  const moduleProgress = useMemo<ModuleProgress | null>(() => {
    if (!moduleDetail || moduleDetail.userModuleLevel === undefined) {
      return null;
    }

    const expMax =
      moduleDetail.expMax && moduleDetail.expMax > 0
        ? moduleDetail.expMax
        : MODULE_EXP_MAX;
    const currentExp = moduleDetail.currentExp ?? 0;
    const expPercent =
      expMax > 0 ? Math.min(100, Math.round((currentExp / expMax) * 100)) : 0;

    return {
      level: moduleDetail.userModuleLevel,
      currentExp,
      expPercent,
    };
  }, [moduleDetail]);

  const selectedOptionIndex = activeQuestion
    ? selectedOptionByContentId[activeQuestion.question.id] ?? null
    : null;

  const selectQuestionUnit = (index: number) => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return;
    }
    const clampedIndex = Math.max(
      0,
      Math.min(index, roomWithLocalAttempts.questions.length - 1),
    );
    setSelectedQuestionUnitIndex(clampedIndex);
  };

  const selectCoreQuestion = (questionUnitId: number) => {
    setSelectedVariantIndexByUnit((previousValue) => ({
      ...previousValue,
      [questionUnitId]: null,
    }));
  };

  const selectVariantQuestion = (questionUnitId: number, variantIndex: number) => {
    const questionUnit = roomWithLocalAttempts?.questions.find(
      (candidate) => candidate.questionUnitId === questionUnitId,
    );
    if (!questionUnit) {
      return;
    }

    const unlockedVariantCount = getUnlockedVariantCount(questionUnit);
    if (variantIndex < 0 || variantIndex >= unlockedVariantCount) {
      return;
    }

    setSelectedVariantIndexByUnit((previousValue) => ({
      ...previousValue,
      [questionUnitId]: variantIndex,
    }));
  };

  const selectOption = (contentId: number, optionIndex: number) => {
    setSelectedOptionOverrideByContentId((previousValue) => ({
      ...previousValue,
      [contentId]: optionIndex,
    }));
  };

  const unlockHintForContent = (contentId: number) => {
    // Hints unlock once per content id and remain available so XP rules can treat unlock as a single event.
    setUnlockedHintByContentId((previousValue) => ({
      ...previousValue,
      [contentId]: true,
    }));
  };

  const isActiveHintUnlocked = activeQuestion
    ? Boolean(unlockedHintByContentId[activeQuestion.question.id])
    : false;

  const goToPreviousQuestionVersion = () => {
    if (!activeQuestionUnit || !activeQuestion || activeQuestion.kind === 'core') {
      return;
    }
    const previousVariantIndex = activeQuestion.index! - 1;
    if (previousVariantIndex < 0) {
      selectCoreQuestion(activeQuestionUnit.questionUnitId);
      return;
    }
    selectVariantQuestion(activeQuestionUnit.questionUnitId, previousVariantIndex);
  };

  const goToNextQuestionVersion = () => {
    if (!activeQuestionUnit) return;
    const unlockedVariantCount = getUnlockedVariantCount(activeQuestionUnit);
    if (unlockedVariantCount <= 0) return;

    if (!activeQuestion || activeQuestion.kind === 'core') {
      selectVariantQuestion(activeQuestionUnit.questionUnitId, 0);
      return;
    }

    const nextVariantIndex = activeQuestion.index! + 1;
    if (nextVariantIndex >= unlockedVariantCount) return;
    selectVariantQuestion(activeQuestionUnit.questionUnitId, nextVariantIndex);
  };

  const goToPreviousQuestionUnit = () => {
    if (!questionUnitNav.canGoPrevious) return;
    setSelectedQuestionUnitIndex((previousValue) => Math.max(0, previousValue - 1));
  };

  const goToNextQuestionUnit = () => {
    if (!roomWithLocalAttempts || !questionUnitNav.canGoNext) return;
    // Cap next index to array bounds to keep navigation resilient after refetches.
    setSelectedQuestionUnitIndex((previousValue) =>
      Math.min(roomWithLocalAttempts.questions.length - 1, previousValue + 1),
    );
  };

  const canSubmitAttempt =
    Boolean(roomWithLocalAttempts && activeQuestionUnit && activeQuestion) &&
    selectedOptionIndex !== null &&
    !submitAttemptMutation.isPending;

  const submitActiveQuestionAttempt = async () => {
    if (
      !roomWithLocalAttempts ||
      !activeQuestionUnit ||
      !activeQuestion ||
      selectedOptionIndex === null
    ) {
      return;
    }

    const studentAnswer: StudentAnswer = {
      selectedOptionIndex,
    };
    const payload: SubmitAttemptPayload = {
      moduleUnitId: roomWithLocalAttempts.moduleUnitId,
      questionUnitId: activeQuestionUnit.questionUnitId,
      questionContentId: activeQuestion.question.id,
      sessionId: roomWithLocalAttempts.sessionId,
      practiceMode: PRACTICE_MODES.PRACTICE_ROOM,
      isCorrect: isSelectedOptionCorrect(activeQuestion.question, selectedOptionIndex),
      // Timing capture will be introduced with the dedicated attempt-timer flow; submit path is wired first.
      timeTakenMs: 0,
      hintUnlocked: isActiveHintUnlocked,
      studentAnswer,
    };

    setSubmitErrorMessage(null);
    try {
      const submitResult = await submitAttemptMutation.mutateAsync(payload);
      setSubmittedAttemptByContentId((previousValue) => ({
        ...previousValue,
        [activeQuestion.question.id]: {
          studentAnswer,
          isCorrect: payload.isCorrect,
        },
      }));
      if (submitResult.hasCorrectAttempt) {
        setHasCorrectAttemptByQuestionUnitId((previousValue) => ({
          ...previousValue,
          [activeQuestionUnit.questionUnitId]: true,
        }));
      }
    } catch (error) {
      const message = getDisplayErrorMessage(error, {
        fallbackMessage:
          'We could not submit your answer right now. Please try again.',
      });
      setSubmitErrorMessage(message);
      if (shouldLogApiError(error)) {
        logError(error, {
          feature: 'practice-room',
          action: 'submit-attempt',
          moduleId: parsedModuleId,
          unitId: parsedUnitId,
        });
      }
    }
  };

  return {
    parsedModuleId,
    parsedUnitId,
    room: roomWithLocalAttempts,
    moduleProgress,
    isLoading:
      practiceRoomQuery.isPending ||
      moduleDetailQuery.isPending ||
      submitAttemptMutation.isPending,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt: submitAttemptMutation.isPending,
    canSubmitAttempt,
    selectedQuestionUnitIndex,
    activeQuestionUnit,
    activeQuestion,
    activeQuestionOptions,
    trackNav,
    questionUnitNav,
    selectedOptionIndex,
    selectQuestionUnit,
    selectOption,
    isActiveHintUnlocked,
    unlockHintForContent,
    submitActiveQuestionAttempt,
    goToPreviousQuestionVersion,
    goToNextQuestionVersion,
    goToPreviousQuestionUnit,
    goToNextQuestionUnit,
  };
}

// Apply local submissions over server snapshots so unlocking/status bars update instantly while query refetch catches up.
function applySubmittedAttemptOverrides(
  questionUnit: PracticeRoomQuestionUnit,
  submittedAttemptByContentId: Record<number, PracticeRoomAttempt>,
  forceHasCorrectAttempt: boolean,
): PracticeRoomQuestionUnit {
  const coreAttemptOverride =
    submittedAttemptByContentId[questionUnit.coreQuestion.questionContent.id];
  const coreQuestion = {
    ...questionUnit.coreQuestion,
    lastAttempt: coreAttemptOverride ?? questionUnit.coreQuestion.lastAttempt,
  };
  const variants = questionUnit.variants.map((variant) => {
    const variantAttemptOverride =
      submittedAttemptByContentId[variant.questionContent.id];
    return {
      ...variant,
      lastAttempt: variantAttemptOverride ?? variant.lastAttempt,
    };
  });

  const hasCorrectAttempt =
    forceHasCorrectAttempt ||
    coreQuestion.lastAttempt?.isCorrect === true ||
    variants.some((variant) => variant.lastAttempt?.isCorrect === true)
      ? true
      : null;

  return {
    ...questionUnit,
    hasCorrectAttempt,
    coreQuestion,
    variants,
  };
}

// Unlock chain: core wrong unlocks variant 1; each wrong variant unlocks exactly the next variant.
function getUnlockedVariantCount(questionUnit: PracticeRoomQuestionUnit): number {
  if (questionUnit.variants.length === 0) {
    return 0;
  }

  if (questionUnit.coreQuestion.lastAttempt?.isCorrect !== false) {
    return 0;
  }

  let unlockedCount = 1;
  for (let variantIndex = 0; variantIndex < questionUnit.variants.length - 1; variantIndex += 1) {
    const currentVariantAttempt = questionUnit.variants[variantIndex]?.lastAttempt;
    if (currentVariantAttempt?.isCorrect !== false) {
      break;
    }
    unlockedCount += 1;
  }

  return Math.min(unlockedCount, questionUnit.variants.length);
}

// Student-answer payloads differ by question type; this helper safely extracts MCQ/true-false indexes when available.
function readSelectedOptionIndex(
  studentAnswer: unknown,
): number | null {
  if (!studentAnswer || typeof studentAnswer !== 'object') {
    return null;
  }
  const candidate = studentAnswer as { selectedOptionIndex?: unknown };
  if (typeof candidate.selectedOptionIndex !== 'number') {
    return null;
  }
  return candidate.selectedOptionIndex;
}

// Render only option-based questions for now; unknown question schemas return an empty list safely.
function readQuestionOptions(
  questionData: unknown,
): Array<{ optionText: string }> {
  if (!questionData || typeof questionData !== 'object') {
    return [];
  }

  const candidate = questionData as Partial<QuestionDataWithOptions>;
  if (!Array.isArray(candidate.options)) {
    // New true/false payloads do not store free-form option text; labels are fixed for rendering.
    if (
      candidate.trueOption &&
      typeof candidate.trueOption === 'object' &&
      candidate.falseOption &&
      typeof candidate.falseOption === 'object'
    ) {
      return [{ optionText: 'True' }, { optionText: 'False' }];
    }
    return [];
  }

  return candidate.options.filter(
    (option): option is { optionText: string } =>
      Boolean(option) &&
      typeof option === 'object' &&
      typeof option.optionText === 'string',
  );
}

// Frontend uses question authoring metadata to compute correctness until backend grading/explanation flow is introduced.
function isSelectedOptionCorrect(
  question: PracticeRoomQuestion,
  selectedOptionIndex: number,
): boolean {
  if (!question.questionData || typeof question.questionData !== 'object') {
    return false;
  }

  if (
    question.type === 'mcq' &&
    'correctOptionIndex' in question.questionData &&
    typeof question.questionData.correctOptionIndex === 'number'
  ) {
    return question.questionData.correctOptionIndex === selectedOptionIndex;
  }

  if (
    question.type === 'true-false' &&
    'trueOption' in question.questionData &&
    'falseOption' in question.questionData &&
    question.questionData.trueOption &&
    question.questionData.falseOption &&
    typeof question.questionData.trueOption === 'object' &&
    typeof question.questionData.falseOption === 'object'
  ) {
    return selectedOptionIndex === 0
      ? Boolean(question.questionData.trueOption.isCorrect)
      : Boolean(question.questionData.falseOption.isCorrect);
  }

  return false;
}
