// Module-unit-scoped student practice-room route that renders unit progress, question-unit bars, and a selectable question panel.
import { motion, AnimatePresence } from 'motion/react';
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
import StreakIndicator from '../../components/StreakIndicator';
import { usePracticeRoomPageState } from '../../hooks/page-state/practice-room/usePracticeRoomPageState';
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
    showLevelUp,
    isLoading,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt,
    isRoomReadOnly,
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
    currentStreak,
    highestStreak,
    isStreakInitialized,
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
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleSection}>
            <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
              ← Back to module
            </Link>
            <h1 className={styles.title}>{room?.moduleUnitTitle ?? 'Loading…'}</h1>
          </div>

          {moduleProgress && (
            <div className={styles.headerProgress}>
              {/* Streak indicator sits left of the XP bar so progress metrics are grouped */}
              <StreakIndicator
                currentStreak={currentStreak}
                highestStreak={highestStreak}
                totalQuestions={room?.questions.length ?? 0}
                isStreakInitialized={isStreakInitialized}
              />
              <div className={styles.levelIndicatorMini}>
                <img src={expIcon} alt="" aria-hidden="true" className={styles.miniLevelIcon} />
                <div className={styles.levelTextWrapper}>
                  <span className={styles.levelText}>Lvl {moduleProgress.level}</span>
                  <AnimatePresence>
                    {showLevelUp && (
                      <motion.span
                        key="level-up-badge"
                        initial={{ opacity: 0, scale: 0.5, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -10 }}
                        transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
                        className={styles.levelUpBadge}
                      >
                        LEVEL UP!
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className={styles.miniBarTrack}>
                  <div
                    className={`${styles.miniBarFill} ${showLevelUp ? styles.miniBarFillLevelUp : ''}`}
                    style={{ width: `${moduleProgress.expPercent}%` }}
                  />
                </div>
                <div className={styles.xpValueContainer}>
                  <span className={styles.miniExpLabel}>{moduleProgress.currentExp} xp</span>
                  {/* Escalator animation: all chips share the same spawn point and move upward
                      at constant speed, staggered so they space out naturally on the track.
                      Opacity holds while readable then fades as chips approach the top.
                      awardId keys ensure chips remount on every new award. */}
                  {moduleExpGainIndicator && (
                    <>
                      {moduleExpGainIndicator.base > 0 && (
                        <motion.span
                          key={`${moduleExpGainIndicator.awardId}-base`}
                          initial={{ y: 0, opacity: 0 }}
                          animate={{ y: -40, opacity: [0, 1, 1, 0] }}
                          transition={{
                            // y starts 0.2s before opacity so the chip is already
                            // moving when it fades in — no visible pause at spawn.
                            y: { ease: 'linear', duration: 2.5, delay: 0 },
                            opacity: { duration: 2.5, times: [0, 0.04, 0.6, 1], delay: 0.2 },
                          }}
                          className={styles.xpFloatChip}
                        >
                          +{moduleExpGainIndicator.base} xp
                        </motion.span>
                      )}
                      {moduleExpGainIndicator.firstAttemptBonus > 0 && (
                        <motion.span
                          key={`${moduleExpGainIndicator.awardId}-1st`}
                          initial={{ y: 0, opacity: 0 }}
                          animate={{ y: -40, opacity: [0, 1, 1, 0] }}
                          transition={{
                            y: { ease: 'linear', duration: 2.5, delay: 0.8 },
                            opacity: { duration: 2.5, times: [0, 0.04, 0.6, 1], delay: 1.0 },
                          }}
                          className={`${styles.xpFloatChip} ${styles.xpFloatChipFirstAttempt}`}
                        >
                          +{moduleExpGainIndicator.firstAttemptBonus} 🎯
                        </motion.span>
                      )}
                      {moduleExpGainIndicator.streakBonus > 0 && (
                        <motion.span
                          key={`${moduleExpGainIndicator.awardId}-streak`}
                          initial={{ y: 0, opacity: 0 }}
                          animate={{ y: -40, opacity: [0, 1, 1, 0] }}
                          transition={{
                            y: { ease: 'linear', duration: 2.5, delay: 1.6 },
                            opacity: { duration: 2.5, times: [0, 0.04, 0.6, 1], delay: 1.8 },
                          }}
                          className={`${styles.xpFloatChip} ${styles.xpFloatChipStreak}`}
                        >
                          +{moduleExpGainIndicator.streakBonus} 🔥
                        </motion.span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {room && (
          <div className={styles.headerBottom}>
            <div className={styles.progressCounter}>
              Question {Math.min(selectedQuestionUnitIndex + 1, room.questions.length)} of{' '}
              {room.questions.length}
            </div>
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
          </div>
        )}
      </header>

      {isLoading ? (
        <div className={styles.statusCard}>Loading practice room…</div>
      ) : pageError ? (
        <div className={styles.statusCard} role="alert">
          {pageError}
        </div>
      ) : room ? (
        <>
          {activeQuestionUnit && activeQuestion ? (
            <section className={styles.questionPanel}>
              <div className={styles.stemHeader}>
                <h2 className={styles.questionStem}>{activeQuestion.question.questionStem}</h2>
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
                    <span className={styles.questionUnitNavLabel}>Prev</span>
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
                        disabled={hasSubmittedActiveQuestion || isRoomReadOnly}
                      >
                        <div className={styles.optionContentWrapper}>
                          <span className={styles.optionLetter}>
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <div className={styles.optionTextRow}>
                            <span className={styles.optionText}>{option.optionText}</span>
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
                      className={`${styles.hintToggle} ${isRoomReadOnly ? styles.hintToggleDisabled : ''}`}
                      onClick={() => {
                        if (!isActiveHintUnlocked && !isRoomReadOnly) {
                          unlockHintForContent(activeQuestion.question.id);
                        }
                      }}
                      aria-expanded={isActiveHintUnlocked}
                      aria-disabled={isActiveHintUnlocked || isRoomReadOnly}
                      onKeyDown={(event) => {
                        if (
                          (event.key === 'Enter' || event.key === ' ') &&
                          !isActiveHintUnlocked &&
                          !isRoomReadOnly
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
