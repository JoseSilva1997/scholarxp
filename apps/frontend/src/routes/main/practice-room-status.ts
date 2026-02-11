// Provides pure status helpers for practice-room question-unit bars so route rendering stays component-only.
import type { PracticeRoomQuestionUnit } from '@scholarxp/api-contracts';

// Derives visual state from current focus and attempts so nav bars communicate progress at a glance.
export function getQuestionUnitStatusClass(
  params: {
    questionUnit: PracticeRoomQuestionUnit;
    isCurrent: boolean;
  },
  css: Record<string, string>,
) {
  const { questionUnit, isCurrent } = params;
  if (isCurrent) {
    return css.navBarCurrent;
  }
  if (questionUnit.hasCorrectAttempt) {
    return css.navBarCorrect;
  }

  // Any recorded attempt with no correctness indicates an incorrect progression so far.
  const hasAnyAttempt =
    questionUnit.coreQuestion.lastAttempt !== null ||
    questionUnit.variants.some((variant) => variant.lastAttempt !== null);
  if (hasAnyAttempt) {
    return css.navBarIncorrect;
  }

  return css.navBarMuted;
}
