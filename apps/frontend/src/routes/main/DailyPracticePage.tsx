// Module-scoped daily-practice route that reuses the practice-room visual language for the adaptive daily set flow.
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { IconContext } from 'react-icons';
import {
  FaChevronDown,
  FaCircleChevronLeft,
  FaCircleChevronRight,
  FaLightbulb,
} from 'react-icons/fa6';
import MainSection from '../../components/MainSection';
import StreakIndicator from '../../components/PracticeRoom/StreakTrackerIndicator';
import expIcon from '../../assets/exp_icon.svg';
import { useDailyPracticePageState } from '../../hooks/page-state/useDailyPracticePageState';
import { useModuleDetailQuery } from '../../hooks/queries/useModulesQueries';
import { buildPracticeRoomAnswerFeedback } from './practice-room-answer-feedback';
import styles from './PracticeRoomPage.module.css';

function getDailyPracticeQuestionStatusClass(
  question: {
    hasCorrectAttempt: boolean | null;
    coreQuestion: {
      lastAttempt: { isCorrect: boolean | null } | null;
    };
  },
  isCurrent: boolean,
) {
  let statusClass = '';

  if (question.hasCorrectAttempt) {
    statusClass = styles.navBarCorrect;
  } else if (question.coreQuestion.lastAttempt !== null) {
    statusClass = styles.navBarIncorrect;
  } else {
    statusClass = styles.navBarMuted;
  }

  return isCurrent ? `${styles.navBarCurrent} ${statusClass}` : statusClass;
}

const DEBUG_MODE = true;

export default function DailyPracticePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const {
    parsedModuleId,
    room,
    isLoading,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt,
    canSubmitAttempt,
    selectedQuestionIndex,
    activeQuestionItem,
    activeQuestion,
    activeQuestionOptions,
    questionNav,
    selectedOptionIndex,
    hasActiveOptionOverride,
    isActiveHintUnlocked,
    currentStreak,
    highestStreak,
    isStreakInitialized,
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    selectQuestion,
    selectOption,
    unlockHintForContent,
    goToPreviousQuestion,
    goToNextQuestion,
    submitActiveQuestionAttempt,
  } = useDailyPracticePageState({ moduleIdParam: moduleId });

  const moduleDetail = useModuleDetailQuery(parsedModuleId);

  const hasSubmittedFeedback =
    activeQuestionItem?.coreQuestion.lastAttempt !== null &&
    !hasActiveOptionOverride;
  const optionFeedback = activeQuestion
    ? buildPracticeRoomAnswerFeedback({
        question: activeQuestion.question,
        selectedOptionIndex,
        hasSubmitted: hasSubmittedFeedback,
        optionCount: activeQuestionOptions.length,
      })
    : [];

  if (!parsedModuleId) {
    return (
      <MainSection className={styles.page}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
            ← Back to module
          </Link>
        </div>
        <div className={styles.statusCard} role="alert">
          Daily practice not found.
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
            <h1 className={styles.title}>
              Daily Practice{moduleDetail.data ? ` - ${moduleDetail.data.title}` : ''}
            </h1>
          </div>

          <div className={styles.headerProgress}>
            <StreakIndicator
              currentStreak={currentStreak}
              highestStreak={highestStreak}
              totalQuestions={room?.questions.length ?? 0}
              isStreakInitialized={isStreakInitialized}
              variant="daily-practice"
            />
            {moduleProgress && (
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
                  {moduleExpGainIndicator && moduleExpGainIndicator.total > 0 && (
                    <motion.span
                      key={`${moduleExpGainIndicator.awardId}-mastery`}
                      initial={{ y: 0, opacity: 0 }}
                      animate={{ y: -40, opacity: [0, 1, 1, 0] }}
                      transition={{
                        y: { ease: 'linear', duration: 2.5, delay: 0 },
                        opacity: { duration: 2.5, times: [0, 0.04, 0.6, 1], delay: 0.2 },
                      }}
                      className={styles.xpFloatChip}
                    >
                      +{moduleExpGainIndicator.total} xp
                    </motion.span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {room ? (
          <div className={styles.headerBottom}>
            <div className={styles.progressCounter}>
              Question {Math.min(selectedQuestionIndex + 1, room.questions.length)} of{' '}
              {room.questions.length}
            </div>
            <nav className={styles.beadRow} aria-label="Daily practice question navigation">
              {room.questions.map((question, index) => (
                <button
                  key={question.questionUnitId}
                  type="button"
                  className={`${styles.navBar} ${getDailyPracticeQuestionStatusClass(
                    question,
                    index === selectedQuestionIndex,
                  )}`}
                  onClick={() => selectQuestion(index)}
                  aria-label={`Question ${index + 1}`}
                  aria-current={index === selectedQuestionIndex ? 'true' : undefined}
                >
                  <span className={styles.navBarInner} aria-hidden="true" />
                </button>
              ))}
            </nav>
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <div className={styles.statusCard}>Loading daily practice…</div>
      ) : pageError ? (
        <div className={styles.statusCard} role="alert">
          {pageError}
        </div>
      ) : room ? (
        activeQuestionItem && activeQuestion ? (
          <section className={styles.questionPanel}>
            <div className={styles.stemHeader}>
              <h2 className={styles.questionStem}>
                {activeQuestion.question.questionStem}
              </h2>
              {DEBUG_MODE ?
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                Debug: moduleUnitId = {activeQuestionItem.moduleUnitId}, questionId ={' '}
                {activeQuestionItem.coreQuestion.questionId}, questionContentId ={' '}
                {activeQuestion.question.id}, module unit title = {activeQuestionItem.moduleUnitTitle}
              </div>
            : null}
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
                        feedback?.isSelectedIncorrect
                          ? styles.optionButtonIncorrect
                          : ''
                      }`}
                      onClick={() =>
                        selectOption(activeQuestion.question.id, optionIndex)
                      }
                      aria-pressed={isSelected}
                    >
                      <div className={styles.optionContentWrapper}>
                        <span className={styles.optionLetter}>
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <div className={styles.optionTextRow}>
                          <span className={styles.optionText}>
                            {option.optionText}
                          </span>
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
                        <p className={styles.optionExplanation}>
                          {feedback.explanation}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.stickyFooter}>
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
                    <span>
                      {isActiveHintUnlocked ? 'Hint unlocked' : 'Unlock hint'}
                    </span>
                    <span
                      className={`${styles.hintChevron} ${
                        isActiveHintUnlocked ? styles.hintChevronExpanded : ''
                      }`}
                      aria-hidden="true"
                    >
                      <FaChevronDown />
                    </span>
                  </div>
                  {isActiveHintUnlocked ? (
                    <p className={styles.hintText}>{activeQuestion.question.hint}</p>
                  ) : null}
                </div>
              ) : null}

              {submitErrorMessage ? (
                <div className={styles.submitError} role="alert">
                  {submitErrorMessage}
                </div>
              ) : null}

              <div className={styles.submitRow}>
                <div className={styles.submitControls}>
                  <div className={styles.questionNavButtons}>
                    <button
                      type="button"
                      className={styles.questionUnitNavButton}
                      onClick={goToPreviousQuestion}
                      disabled={!questionNav.canGoPrevious}
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
                      onClick={goToNextQuestion}
                      disabled={!questionNav.canGoNext}
                      aria-label="Next question"
                    >
                      <span className={styles.questionUnitNavLabel}>Next</span>
                      <IconContext.Provider value={{ className: styles.navIcon }}>
                        <FaCircleChevronRight />
                      </IconContext.Provider>
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={() => {
                      void submitActiveQuestionAttempt();
                    }}
                    disabled={!canSubmitAttempt}
                  >
                    {isSubmittingAttempt ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className={styles.statusCard}>
            No daily practice questions are available for this module yet.
          </div>
        )
      ) : null}
    </MainSection>
  );
}
