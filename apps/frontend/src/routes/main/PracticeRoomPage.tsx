// Student practice-room route that renders unit progress, bead navigation, and a selectable question panel.
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

export default function PracticeRoomPage() {
  const { moduleId, unitId } = useParams<{ moduleId: string; unitId: string }>();
  const {
    parsedModuleId,
    parsedUnitId,
    room,
    moduleProgress,
    isLoading,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt,
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
  } = usePracticeRoomPageState({
    moduleIdParam: moduleId,
    unitIdParam: unitId,
  });

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
      <div className={styles.topBar}>
        <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
          ← Back to module
        </Link>
      </div>

      {moduleProgress ? (
        <div className={styles.progressContainer}>
          <div className={styles.progressRow} aria-label="Module progress">
            {/* Keep progress visible inside practice so students can see momentum while answering questions. */}
            <span className={styles.level}>
              <img src={expIcon} alt="" aria-hidden="true" className={styles.levelIcon} />
              Level {moduleProgress.level}
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
            <span className={styles.expLabel}>{moduleProgress.currentExp} xp</span>
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
                className={`${styles.navBar} ${getQuestionUnitStatusClass({
                  questionUnit,
                  isCurrent: index === selectedQuestionUnitIndex,
                }, styles)}`}
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
              <div className={styles.questionTrackNav}>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={goToPreviousQuestionVersion}
                  disabled={!trackNav.canGoPrevious}
                  aria-label="Previous question or variant"
                >
                  <IconContext.Provider value={{ className: styles.navIcon }}>
                    <FaCircleChevronLeft />
                  </IconContext.Provider>
                </button>
                <span className={styles.variantLabel}>{trackNav.activeLabel}</span>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={goToNextQuestionVersion}
                  disabled={!trackNav.canGoNext}
                  aria-label="Next question or variant"
                >
                  <IconContext.Provider value={{ className: styles.navIcon }}>
                    <FaCircleChevronRight />
                  </IconContext.Provider>
                </button>
              </div>

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
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      className={`${styles.optionButton} ${
                        isSelected ? styles.optionButtonSelected : ''
                      }`}
                      onClick={() => selectOption(activeQuestion.question.id, optionIndex)}
                      aria-pressed={isSelected}
                    >
                      {option.optionText}
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

              {submitErrorMessage ? (
                <div className={styles.submitError} role="alert">
                  {submitErrorMessage}
                </div>
              ) : null}

              <div className={styles.submitRow}>
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={() => {
                    void submitActiveQuestionAttempt();
                  }}
                  disabled={!canSubmitAttempt}
                >
                  {isSubmittingAttempt ? 'Submitting…' : 'Submit answer'}
                </button>
              </div>

              <div className={styles.questionUnitTrackNav}>
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
