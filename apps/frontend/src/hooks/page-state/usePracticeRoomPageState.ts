// Encapsulates practice-room route orchestration so the page component can stay presentational.
import { useEffect, useMemo, useState } from 'react';
import type {
  PracticeRoomQuestion,
  PracticeRoomQuestionUnit,
} from '@scholarxp/api-contracts';
import { MODULE_EXP_MAX } from '@scholarxp/constants';
import { getDisplayErrorMessage, shouldLogApiError } from '../../api/get-display-error';
import { logError } from '../../utils/logger';
import { usePracticeRoomQuery } from '../queries/usePracticeRoomQueries';
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

  const seededOptionByContentId = useMemo(() => {
    if (!room) return {};

    // Seed option selections from latest attempts to preserve continuity when students re-enter a session.
    const seededSelection: Record<number, number> = {};
    for (const questionUnit of room.questions) {
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
  }, [room]);

  const selectedOptionByContentId = useMemo(
    () => ({
      ...seededOptionByContentId,
      ...selectedOptionOverrideByContentId,
    }),
    [seededOptionByContentId, selectedOptionOverrideByContentId],
  );

  const activeQuestionUnit = useMemo<PracticeRoomQuestionUnit | null>(() => {
    if (!room || room.questions.length === 0) return null;
    const clampedSelectedIndex = Math.max(
      0,
      Math.min(selectedQuestionUnitIndex, room.questions.length - 1),
    );
    return room.questions[clampedSelectedIndex] ?? room.questions[0];
  }, [room, selectedQuestionUnitIndex]);

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
    if (!room || room.questions.length === 0) {
      return { canGoPrevious: false, canGoNext: false };
    }
    return {
      canGoPrevious: selectedQuestionUnitIndex > 0,
      canGoNext: selectedQuestionUnitIndex < room.questions.length - 1,
    };
  }, [room, selectedQuestionUnitIndex]);

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
    if (!room || room.questions.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, room.questions.length - 1));
    setSelectedQuestionUnitIndex(clampedIndex);
  };

  const selectCoreQuestion = (questionUnitId: number) => {
    setSelectedVariantIndexByUnit((previousValue) => ({
      ...previousValue,
      [questionUnitId]: null,
    }));
  };

  const selectVariantQuestion = (questionUnitId: number, variantIndex: number) => {
    const questionUnit = room?.questions.find(
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
    if (!room || !questionUnitNav.canGoNext) return;
    // Cap next index to array bounds to keep navigation resilient after refetches.
    setSelectedQuestionUnitIndex((previousValue) =>
      Math.min(room.questions.length - 1, previousValue + 1),
    );
  };

  return {
    parsedModuleId,
    parsedUnitId,
    room,
    moduleProgress,
    isLoading: practiceRoomQuery.isPending || moduleDetailQuery.isPending,
    pageError,
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
    goToPreviousQuestionVersion,
    goToNextQuestionVersion,
    goToPreviousQuestionUnit,
    goToNextQuestionUnit,
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
