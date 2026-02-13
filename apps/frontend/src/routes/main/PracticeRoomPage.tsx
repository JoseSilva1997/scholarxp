// Module-unit-scoped student practice-room route that renders unit progress, question-unit bars, and a selectable question panel.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useParams } from 'react-router-dom';
import { IconContext } from 'react-icons';
import {
  FaChevronRight,
  FaCircleChevronLeft,
  FaCircleChevronRight,
  FaLightbulb,
} from 'react-icons/fa6';
import expIcon from '../../assets/exp_icon.svg';
import MainSection from '../../components/MainSection';
import { usePracticeRoomPageState } from '../../hooks/page-state/usePracticeRoomPageState';
import styles from './PracticeRoomPage.module.css';
import { getQuestionUnitStatusClass } from './practice-room-status';
import { buildPracticeRoomAnswerFeedback } from './practice-room-answer-feedback';

export default function PracticeRoomPage() {
  const { moduleId, unitId } = useParams<{ moduleId: string; unitId: string }>();
  const {
    parsedModuleId,
    parsedUnitId,
    room,
    moduleProgress,
    moduleExpGainIndicator,
    isLoading,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt,
    canSubmitAttempt,
    selectedQuestionUnitIndex,
    activeQuestionUnit,
    activeQuestion,
    activeQuestionOptions,
    questionUnitNav,
    selectedOptionIndex,
    hasSubmittedActiveQuestion,
    hasActiveOptionOverride,
    showTryAgainButton,
    selectQuestionUnit,
    selectOption,
    isActiveHintUnlocked,
    unlockHintForContent,
    tryAgainActiveQuestion,
    submitActiveQuestionAttempt,
    goToPreviousQuestionUnit,
    goToNextQuestionUnit,
  } = usePracticeRoomPageState({
    moduleIdParam: moduleId,
    unitIdParam: unitId,
  });

  // Feedback remains presentation-only and uses local question data so it can be swapped to server-driven feedback later.
  // Revisited questions render prior feedback until the student starts a new draft selection.
  const hasSubmittedFeedback =
    hasSubmittedActiveQuestion ||
    (activeQuestionUnit?.coreQuestion.lastAttempt !== null &&
      !hasActiveOptionOverride);
  const optionFeedback = activeQuestion
    ? buildPracticeRoomAnswerFeedback({
        question: activeQuestion.question,
        selectedOptionIndex,
        hasSubmitted: hasSubmittedFeedback,
        optionCount: activeQuestionOptions.length,
      })
    : [];
  const previousLevelRef = useRef<number | null>(null);
  const [levelUpAnimationCycle, setLevelUpAnimationCycle] = useState(0);

  useEffect(() => {
    const nextLevel = moduleProgress?.level;
    if (nextLevel === undefined) {
      previousLevelRef.current = null;
      return;
    }

    const previousLevel = previousLevelRef.current;
    if (previousLevel === null) {
      previousLevelRef.current = nextLevel;
      return;
    }
    if (nextLevel <= previousLevel) {
      return;
    }

    previousLevelRef.current = nextLevel;

    // Advancing this cycle remounts motion elements so each level-up gets one fresh burst.
    setLevelUpAnimationCycle((previousValue) => previousValue + 1);
  }, [moduleProgress?.level]);

  if (!parsedModuleId || !parsedUnitId) {
    return (
      <MainSection className={styles.page}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
            ← Back to module
          </Link>
        </div>
        <div className={styles.statusCard} role="alert">
          Practice room not found.
        </div>
      </MainSection>
    );
  }

  return (
    <MainSection className={styles.page}>
      {moduleProgress ? (
        <div className={styles.progressContainer}>
          <div className={styles.progressRow} aria-label="Module progress">
            {/* Keep progress visible inside practice so students can see momentum while answering questions. */}
            <span className={styles.level}>
              <img src={expIcon} alt="" aria-hidden="true" className={styles.levelIcon} />
              Level{' '}<span className={styles.levelValueWrap}>
                {levelUpAnimationCycle > 0 ? (
                  <motion.span
                    key={`level-rays-${levelUpAnimationCycle}`}
                    aria-hidden="true"
                    className={styles.levelRays}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0.6, 1.15, 1.45],
                      y: [0, -5, 0],
                    }}
                    transition={{
                      duration: 0.7,
                      ease: 'easeOut',
                      times: [0, 0.35, 1],
                    }}
                  />
                ) : null}
                <motion.span
                  key={`level-value-${levelUpAnimationCycle}`}
                  className={styles.levelValue}
                  initial={
                    levelUpAnimationCycle === 0 ? false : { y: 0, scale: 1 }
                  }
                  animate={
                    levelUpAnimationCycle === 0
                      ? { y: 0, scale: 1 }
                      : { y: [0, -5, 0], scale: [1, 1.65, 1] }
                  }
                  transition={{
                    duration: 0.7,
                    ease: 'easeOut',
                    times: [0, 0.4, 1],
                  }}
                >
                  {moduleProgress.level}
                </motion.span>
              </span>
            </span>
            <div
              className={styles.barTrack}
              role="progressbar"
              aria-valuenow={moduleProgress.expPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={styles.barFill} style={{ width: `${moduleProgress.expPercent}%` }} />
            </div>
            <div className={styles.expLabelRow}>
              <span className={styles.expLabel}>{moduleProgress.currentExp} xp</span>
              {moduleExpGainIndicator ? (
                <span className={styles.expGain}>+{moduleExpGainIndicator}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.statusCard}>Loading practice room…</div>
      ) : pageError ? (
        <div className={styles.statusCard} role="alert">
          {pageError}
        </div>
      ) : room ? (
        <>
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>{room.moduleUnitTitle}</h1>
            </div>
            <div className={styles.progressMeta}>
              <span>
                Question {Math.min(selectedQuestionUnitIndex + 1, room.questions.length)} of{' '}
                {room.questions.length}
              </span>
            </div>
          </header>

          <nav className={styles.beadRow} aria-label="Question navigation">
            {room.questions.map((questionUnit, index) => (
              <button
                key={questionUnit.questionUnitId}
                type="button"
                className={`${styles.navBar} ${getQuestionUnitStatusClass(
                  {
                    questionUnit,
                    isCurrent: index === selectedQuestionUnitIndex,
                  },
                  styles,
                )}`}
                onClick={() => selectQuestionUnit(index)}
                aria-label={`Question ${index + 1}`}
                aria-current={index === selectedQuestionUnitIndex ? 'true' : undefined}
              >
                <span className={styles.navBarInner} aria-hidden="true" />
              </button>
            ))}
          </nav>

          {activeQuestionUnit && activeQuestion ? (
            <section className={styles.questionPanel}>
              <h2 className={styles.questionStem}>{activeQuestion.question.questionStem}</h2>
              <div className={styles.questionContent}>
                <div
                  className={`${styles.optionsList} ${
                    activeQuestion.question.type === 'true-false'
                      ? styles.optionsListTrueFalse
                      : ''
                  }`}
                >
                  {activeQuestionOptions.map((option, optionIndex) => {
                    const isSelected = selectedOptionIndex === optionIndex;
                    const feedback = optionFeedback[optionIndex];

                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        className={`${styles.optionButton} ${
                          isSelected ? styles.optionButtonSelected : ''
                        } ${
                          feedback?.isCorrectOption ? styles.optionButtonCorrect : ''
                        } ${
                          feedback?.isSelectedIncorrect ? styles.optionButtonIncorrect : ''
                        }`}
                        onClick={() => selectOption(activeQuestion.question.id, optionIndex)}
                        aria-pressed={isSelected}
                        disabled={hasSubmittedActiveQuestion}
                      >
                        <div className={styles.optionTextRow}>
                          <span>{option.optionText}</span>
                          {feedback?.statusLabel ? (
                            <span
                              className={`${
                                feedback.statusLabel === 'Correct'
                                  ? styles.optionStatusCorrect
                                  : styles.optionStatusIncorrect
                              }`}
                            >
                              {feedback.statusLabel}
                            </span>
                          ) : null}
                        </div>
                        {feedback?.explanation ? (
                          <p className={styles.optionExplanation}>{feedback.explanation}</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {activeQuestion.question.hint ? (
                  <div className={styles.hintSection}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={styles.hintToggle}
                      onClick={() => {
                        if (!isActiveHintUnlocked) {
                          unlockHintForContent(activeQuestion.question.id);
                        }
                      }}
                      aria-expanded={isActiveHintUnlocked}
                      aria-disabled={isActiveHintUnlocked}
                      onKeyDown={(event) => {
                        if (
                          (event.key === 'Enter' || event.key === ' ') &&
                          !isActiveHintUnlocked
                        ) {
                          event.preventDefault();
                          unlockHintForContent(activeQuestion.question.id);
                        }
                      }}
                    >
                      <IconContext.Provider value={{ className: styles.hintIcon }}>
                        <FaLightbulb />
                      </IconContext.Provider>
                      <span>{isActiveHintUnlocked ? 'Hint unlocked' : 'Unlock hint'}</span>
                      <span
                        className={`${styles.hintChevron} ${
                          isActiveHintUnlocked ? styles.hintChevronExpanded : ''
                        }`}
                        aria-hidden="true"
                      >
                        <FaChevronRight />
                      </span>
                    </div>
                    {isActiveHintUnlocked ? (
                      <p className={styles.hintText}>{activeQuestion.question.hint}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {submitErrorMessage ? (
                <div className={styles.submitError} role="alert">
                  {submitErrorMessage}
                </div>
              ) : null}

              <div className={styles.submitRow}>
                {showTryAgainButton ? (
                  <button
                    type="button"
                    className={styles.tryAgainButton}
                    onClick={tryAgainActiveQuestion}
                  >
                    Try again
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={() => {
                    void submitActiveQuestionAttempt();
                  }}
                  disabled={!canSubmitAttempt}
                >
                  {isSubmittingAttempt
                    ? 'Submitting…'
                    : hasSubmittedActiveQuestion
                      ? 'Submitted'
                      : 'Submit answer'}
                </button>
              </div>

              <div className={styles.questionUnitTrackNav}>
                <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
                  ← Back to module
                </Link>
                <div className={styles.questionNavButtons}>
                  <button
                    type="button"
                    className={styles.questionUnitNavButton}
                    onClick={goToPreviousQuestionUnit}
                    disabled={!questionUnitNav.canGoPrevious}
                    aria-label="Previous question"
                  >
                    <IconContext.Provider value={{ className: styles.navIcon }}>
                      <FaCircleChevronLeft />
                    </IconContext.Provider>
                    <span className={styles.questionUnitNavLabel}>Previous</span>
                  </button>
                  <button
                    type="button"
                    className={styles.questionUnitNavButton}
                    onClick={goToNextQuestionUnit}
                    disabled={!questionUnitNav.canGoNext}
                    aria-label="Next question"
                  >
                    <span className={styles.questionUnitNavLabel}>Next</span>
                    <IconContext.Provider value={{ className: styles.navIcon }}>
                      <FaCircleChevronRight />
                    </IconContext.Provider>
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <div className={styles.statusCard}>
              No practice questions are available for this unit yet.
            </div>
          )}
        </>
      ) : null}
    </MainSection>
  );
}
