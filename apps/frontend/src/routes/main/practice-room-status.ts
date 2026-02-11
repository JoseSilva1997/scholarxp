// Provides pure status helpers for practice-room question-unit bars so route rendering stays component-only.
import type { PracticeQuestionUnit } from '@scholarxp/api-contracts';

// Derives visual state from current focus and attempts so nav bars communicate progress at a glance.
export function getQuestionUnitStatusClass(
  params: {
    questionUnit: PracticeQuestionUnit;
    isCurrent: boolean;
  },
  css: Record<string, string>,
) {
  const { questionUnit, isCurrent } = params;
  
  let statusClass = '';
  if (questionUnit.hasCorrectAttempt) {
    statusClass = css.navBarCorrect;
  } else {
    // Any recorded attempt with no correctness indicates an incorrect progression so far.
    const hasAnyAttempt =
      questionUnit.coreQuestion.lastAttempt !== null ||
      questionUnit.variants.some((variant) => variant.lastAttempt !== null);
    if (hasAnyAttempt) {
      statusClass = css.navBarIncorrect;
    } else {
      statusClass = css.navBarMuted;
    }
  }
  
  if (isCurrent) {
    return `${css.navBarCurrent} ${statusClass}`;
  }
  
  return statusClass;
}
