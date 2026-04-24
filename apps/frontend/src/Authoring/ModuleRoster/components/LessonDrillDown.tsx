// Lesson drill-down panel: shows per-student status and question-health metrics for a selected lesson.
import { useState } from 'react';
import type {
  HighHintUsageRow,
  LessonDrilldownResponse,
  QuestionAccuracySummary,
  QuestionVariantDiscrepancy,
  SlowQuestionRow,
} from '@scholarxp/api-contracts';
import defaultAvatar from '@/assets/default-profile-pic.png';
import styles from '@/Authoring/ModuleRoster/components/LessonDrillDown.module.css';

type LessonDrillDownProps = {
  detail: LessonDrilldownResponse | undefined;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
};

// Keep avatar fallback aligned with the student roster so backend defaults do not break image rendering.
function resolveAvatar(url: string | null): string {
  if (!url) return defaultAvatar;
  return url.startsWith('http') ? url : defaultAvatar;
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatDelta(value: number): string {
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return `${value > 0 ? '+' : ''}${formatted}pp`;
}

function formatSeconds(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}s`;
}

function SkeletonDetail() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonBar} style={{ width: '60%' }} />
      <div className={styles.skeletonBar} style={{ width: '40%' }} />
      <div className={styles.skeletonBar} style={{ width: '80%' }} />
      <div className={styles.skeletonBar} style={{ width: '50%' }} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyText}>{message}</p>;
}

function SectionToggle({
  title,
  isOpen,
  onToggle,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.sectionToggle}
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      <span className={styles.sectionTitle}>{title}</span>
      <span className={styles.sectionToggleIcon} aria-hidden="true">
        {isOpen ? '−' : '+'}
      </span>
    </button>
  );
}

function StrugglingQuestionsTable({ rows }: { rows: QuestionAccuracySummary[] }) {
  if (rows.length === 0) return <EmptyState message="No struggling questions identified." />;

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.healthTable}>
        <thead>
          <tr>
            <th>Question</th>
            <th>First-Attempt Accuracy</th>
            <th>Overall Accuracy</th>
            <th>Total Attempts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((question) => (
            <tr key={question.questionId}>
              <td>{question.questionTitle}</td>
              <td className={question.firstAttemptAccuracy < 50 ? styles.lowAccuracy : undefined}>
                {formatPercent(question.firstAttemptAccuracy)}
              </td>
              <td>{formatPercent(question.overallAccuracy)}</td>
              <td>{question.totalAttempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariantDiscrepancyTable({ rows }: { rows: QuestionVariantDiscrepancy[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No significant core vs. variant discrepancies found." />;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.healthTable}>
        <thead>
          <tr>
            <th>Question</th>
            <th>Core Accuracy</th>
            <th>Variant</th>
            <th>Variant Accuracy</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((question) => (
            <tr key={`${question.questionId}-${question.variantLabel}`}>
              <td>{question.questionTitle}</td>
              <td>{formatPercent(question.coreAccuracy)}</td>
              <td>{question.variantLabel}</td>
              <td>{formatPercent(question.variantAccuracy)}</td>
              <td className={styles.deltaWarning}>{formatDelta(question.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HighHintTable({ rows }: { rows: HighHintUsageRow[] }) {
  if (rows.length === 0) return <EmptyState message="No questions with high hint usage." />;

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.healthTable}>
        <thead>
          <tr>
            <th>Question</th>
            <th>Hint Usage Rate</th>
            <th>Students w/ Hint</th>
            <th>Total Students</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((question) => (
            <tr key={question.questionId}>
              <td>{question.questionTitle}</td>
              <td className={styles.deltaWarning}>{formatPercent(question.hintUsageRate)}</td>
              <td>{question.studentsWithHint}</td>
              <td>{question.totalStudents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlowQuestionsTable({ rows }: { rows: SlowQuestionRow[] }) {
  if (rows.length === 0) return <EmptyState message="No unusually slow questions detected." />;

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.healthTable}>
        <thead>
          <tr>
            <th>Question</th>
            <th>Median Time</th>
            <th>Lesson Median</th>
            <th>Qualifying Attempts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((question) => (
            <tr key={question.questionId}>
              <td>{question.questionTitle}</td>
              <td className={styles.deltaWarning}>{formatSeconds(question.medianTimeSec)}</td>
              <td>{formatSeconds(question.lessonMedianTimeSec)}</td>
              <td>{question.qualifyingAttempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LessonDrillDown({
  detail,
  isLoading,
  error,
  onClose,
}: LessonDrillDownProps) {
  const [isStudentsOpen, setIsStudentsOpen] = useState(true);
  const [isQuestionHealthOpen, setIsQuestionHealthOpen] = useState(true);

  if (error) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Lesson Detail</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close lesson detail">
            &times;
          </button>
        </div>
        <div className={styles.errorMessage} role="alert">{error}</div>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Lesson Detail</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close lesson detail">
            &times;
          </button>
        </div>
        <SkeletonDetail />
      </div>
    );
  }

  const { students, questionHealth } = detail;

  return (
    <div className={styles.panel} role="region" aria-label={`Details for ${detail.lessonTitle}`}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>{detail.lessonTitle}</span>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close lesson detail">
          &times;
        </button>
      </div>

      <section className={styles.section}>
        <SectionToggle
          title="Students"
          isOpen={isStudentsOpen}
          onToggle={() => setIsStudentsOpen((prev) => !prev)}
        />

        {isStudentsOpen && (
          students.length === 0 ? (
            <EmptyState message="No enrolled students." />
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.healthTable}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Completed</th>
                    <th>Mastery</th>
                    <th>Last Practiced</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.studentId}>
                      <td>
                        <div className={styles.studentCell}>
                          <img
                            src={resolveAvatar(student.avatarUrl)}
                            alt=""
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            className={styles.avatar}
                            aria-hidden="true"
                          />
                          <span>{student.fullName}</span>
                        </div>
                      </td>
                      <td>{student.isCompleted ? 'Yes' : 'No'}</td>
                      <td>{student.masteryScore !== null ? formatPercent(student.masteryScore) : '--'}</td>
                      <td>{formatDate(student.lastPracticedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      <section className={styles.section}>
        <SectionToggle
          title="Question Health"
          isOpen={isQuestionHealthOpen}
          onToggle={() => setIsQuestionHealthOpen((prev) => !prev)}
        />

        {isQuestionHealthOpen && (
          <>
            <div className={styles.subsection}>
              <h4 className={styles.subsectionTitle}>Top Struggling Questions</h4>
              {/* These labels stay explicit because instructors need both initial difficulty and retry recovery. */}
              <p className={styles.metricNote}>
                First-attempt accuracy shows initial difficulty. Overall accuracy shows whether retries help students recover.
              </p>
              <StrugglingQuestionsTable rows={questionHealth.strugglingQuestions} />
            </div>

            <div className={styles.subsection}>
              <h4 className={styles.subsectionTitle}>Core vs. Variant Discrepancy</h4>
              <VariantDiscrepancyTable rows={questionHealth.variantDiscrepancies} />
            </div>

            <div className={styles.subsection}>
              <h4 className={styles.subsectionTitle}>High Hint Usage</h4>
              <HighHintTable rows={questionHealth.highHintUsage} />
            </div>

            <div className={styles.subsection}>
              <h4 className={styles.subsectionTitle}>Slow Questions</h4>
              <SlowQuestionsTable rows={questionHealth.slowQuestions} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
