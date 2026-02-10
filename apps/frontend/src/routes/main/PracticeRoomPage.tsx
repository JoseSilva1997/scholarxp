// Student practice-room route that renders unit progress, bead navigation, and a selectable question panel.
import { Link, useParams } from 'react-router-dom';
import { IconContext } from 'react-icons';
import { FaCircleChevronLeft, FaCircleChevronRight } from 'react-icons/fa6';
import expIcon from '../../assets/exp_icon.svg';
import MainSection from '../../components/MainSection';
import { usePracticeRoomPageState } from '../../hooks/page-state/usePracticeRoomPageState';
import styles from './PracticeRoomPage.module.css';
import type { PracticeRoomQuestionUnit } from '@scholarxp/api-contracts';

export default function PracticeRoomPage() {
  const { moduleId, unitId } = useParams<{ moduleId: string; unitId: string }>();
  const {
    parsedModuleId,
    parsedUnitId,
    room,
    moduleProgress,
    isLoading,
    pageError,
    selectedQuestionUnitIndex,
    activeQuestionUnit,
    activeQuestion,
    activeQuestionOptions,
    trackNav,
    selectedOptionIndex,
    selectQuestionUnit,
    selectOption,
    goToPreviousQuestionVersion,
    goToNextQuestionVersion,
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

              <div className={styles.optionsList}>
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

// Derives visual state from current focus and attempts so nav bars communicate progress at a glance.
function getQuestionUnitStatusClass(
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
