// Tests DailyPracticePage route branches and interaction wiring using a mocked page-state hook.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import type {
  DailyPracticeQuestionItem,
  DailyPracticeTodayResponse,
} from '@scholarxp/api-contracts';
import DailyPracticePage from './DailyPracticePage';

let routeParams: { moduleId?: string } = {
  moduleId: '7',
};

const mocks = vi.hoisted(() => ({
  selectQuestion: vi.fn(),
  selectOption: vi.fn(),
  unlockHintForContent: vi.fn(),
  goToPreviousQuestion: vi.fn(),
  goToNextQuestion: vi.fn(),
  submitActiveQuestionAttempt: vi.fn(),
}));

function buildQuestion(
  overrides?: Partial<DailyPracticeQuestionItem>,
): DailyPracticeQuestionItem {
  return {
    questionUnitId: 101,
    moduleUnitId: 11,
    moduleUnitTitle: 'Lesson 1',
    position: 0,
    hasCorrectAttempt: null,
    sourceBucket: 'due_review',
    coreQuestion: {
      questionId: 101,
      questionContent: {
        id: 501,
        questionStem: 'Question?',
        type: 'mcq',
        questionData: {
          options: [{ optionText: 'A' }, { optionText: 'B' }],
          correctOptionIndex: 0,
        } as DailyPracticeQuestionItem['coreQuestion']['questionContent']['questionData'],
        hint: null,
        difficultyScore: 1,
      },
      lastAttempt: null,
    },
    ...overrides,
  };
}

type MockPageState = {
  parsedModuleId: number | null;
  room: DailyPracticeTodayResponse | null;
  progress: DailyPracticeTodayResponse['progress'] | null;
  isLoading: boolean;
  pageError: string | null;
  submitErrorMessage: string | null;
  isSubmittingAttempt: boolean;
  canSubmitAttempt: boolean;
  selectedQuestionIndex: number;
  activeQuestionItem: DailyPracticeQuestionItem | null;
  activeQuestion: {
    question: DailyPracticeQuestionItem['coreQuestion']['questionContent'];
  } | null;
  activeQuestionOptions: Array<{ optionText: string }>;
  questionNav: { canGoPrevious: boolean; canGoNext: boolean };
  selectedOptionIndex: number | null;
  hasActiveOptionOverride: boolean;
  isActiveHintUnlocked: boolean;
};

let pageState: MockPageState = {
  parsedModuleId: 7,
  room: null,
  progress: null,
  isLoading: true,
  pageError: null,
  submitErrorMessage: null,
  isSubmittingAttempt: false,
  canSubmitAttempt: false,
  selectedQuestionIndex: 0,
  activeQuestionItem: null,
  activeQuestion: null,
  activeQuestionOptions: [],
  questionNav: { canGoPrevious: false, canGoNext: false },
  selectedOptionIndex: null,
  hasActiveOptionOverride: false,
  isActiveHintUnlocked: false,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useParams: () => routeParams,
  };
});

vi.mock('../../hooks/page-state/useDailyPracticePageState', () => ({
  useDailyPracticePageState: () => ({
    ...pageState,
    selectQuestion: mocks.selectQuestion,
    selectOption: mocks.selectOption,
    unlockHintForContent: mocks.unlockHintForContent,
    goToPreviousQuestion: mocks.goToPreviousQuestion,
    goToNextQuestion: mocks.goToNextQuestion,
    submitActiveQuestionAttempt: mocks.submitActiveQuestionAttempt,
  }),
}));

vi.mock('../../components/MainSection', () => ({
  default: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <section className={className}>{children}</section>,
}));

describe('DailyPracticePage route', () => {
  beforeEach(() => {
    routeParams = { moduleId: '7' };
    pageState = {
      parsedModuleId: 7,
      room: null,
      progress: null,
      isLoading: true,
      pageError: null,
      submitErrorMessage: null,
      isSubmittingAttempt: false,
      canSubmitAttempt: false,
      selectedQuestionIndex: 0,
      activeQuestionItem: null,
      activeQuestion: null,
      activeQuestionOptions: [],
      questionNav: { canGoPrevious: false, canGoNext: false },
      selectedOptionIndex: null,
      hasActiveOptionOverride: false,
      isActiveHintUnlocked: false,
    };
    vi.clearAllMocks();
  });

  it('renders loading and error branches', () => {
    render(
      <MemoryRouter>
        <DailyPracticePage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Loading daily practice…')).toBeInTheDocument();

    pageState.isLoading = false;
    pageState.pageError = 'Failed to load';
    render(
      <MemoryRouter>
        <DailyPracticePage />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Failed to load');
  });

  it('renders question content and delegates selection and submit handlers', () => {
    const question = buildQuestion({
      coreQuestion: {
        questionId: 101,
        questionContent: {
          id: 501,
          questionStem: 'Question?',
          type: 'mcq',
          questionData: {
            options: [{ optionText: 'A' }, { optionText: 'B' }],
            correctOptionIndex: 0,
          } as DailyPracticeQuestionItem['coreQuestion']['questionContent']['questionData'],
          hint: 'Helpful hint',
          difficultyScore: 1,
        },
        lastAttempt: null,
      },
    });
    pageState.isLoading = false;
    pageState.progress = {
      totalQuestions: 1,
      answeredQuestions: 0,
      completedAt: null,
    };
    pageState.room = {
      setId: 'set-1',
      moduleId: 7,
      practiceDateUtc: '2026-03-20T00:00:00.000Z',
      sessionId: 'session-1',
      algorithmVersion: 'fsrs_v1',
      progress: pageState.progress,
      questions: [question],
    };
    pageState.activeQuestionItem = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];
    pageState.canSubmitAttempt = true;

    render(
      <MemoryRouter>
        <DailyPracticePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Daily Practice')).toBeInTheDocument();
    expect(screen.getByText('Lesson 1')).toBeInTheDocument();
    expect(screen.getByText('Question?')).toBeInTheDocument();
    expect(screen.getByText('0/1 answered')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Question 1/i }));
    expect(mocks.selectQuestion).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: /Unlock hint/i }));
    expect(mocks.unlockHintForContent).toHaveBeenCalledWith(501);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(mocks.submitActiveQuestionAttempt).toHaveBeenCalled();
  });
});
