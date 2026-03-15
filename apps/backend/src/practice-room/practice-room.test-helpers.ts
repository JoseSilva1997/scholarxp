/* Test role: centralizes practice-room unit-test fixtures so specs stay focused
 on behavior instead of repeating the same ids and payload builders.
 */
import type { SubmitAttemptDto } from './dto/submit-attempt.dto';
import type {
  LoadedModuleUnit,
  OwnedPracticeSession,
  RoomQuestionUnitDraft,
} from './practice-room.types';

export const TEST_MODULE_ID = 1;
export const TEST_MODULE_UNIT_ID = 10;
export const TEST_STUDENT_ID = 100;
export const TEST_QUESTION_UNIT_ID = 25;
export const TEST_QUESTION_CONTENT_ID = 35;
export const TEST_SESSION_ID = '11111111-1111-4111-8111-111111111111';

// Shared ids keep spec expectations aligned across facade and extracted service tests.
export const buildOwnedPracticeSession = (
  overrides: Partial<OwnedPracticeSession> = {},
): OwnedPracticeSession => ({
  id: TEST_SESSION_ID,
  sessionType: 'practice_room',
  endTime: null,
  ...overrides,
});

// Module-unit fixtures are reused by read and facade specs so content-shaping assertions stay consistent.
export const buildLoadedModuleUnit = (
  overrides: Partial<LoadedModuleUnit> = {},
): LoadedModuleUnit => ({
  id: TEST_MODULE_UNIT_ID,
  title: 'Intro to Cells',
  questionUnits: [],
  ...overrides,
});

// Draft fixtures model the mapper output consumed by room-response assembly and latest-attempt lookups.
export const buildQuestionUnitDraft = (
  overrides: Partial<RoomQuestionUnitDraft> = {},
): RoomQuestionUnitDraft => ({
  questionUnitId: TEST_QUESTION_UNIT_ID,
  coreContentId: TEST_QUESTION_CONTENT_ID,
  coreQuestion: {
    questionId: TEST_QUESTION_UNIT_ID,
    questionContent: {
      id: TEST_QUESTION_CONTENT_ID,
      type: 'mcq',
      questionStem: 'Which answer is correct?',
      questionData: {
        // The shared MCQ contract requires four options, so tests should use a valid canonical shape too.
        options: [
          { optionText: 'A' },
          { optionText: 'B' },
          { optionText: 'C' },
          { optionText: 'D' },
        ],
        correctOptionIndex: 1,
      },
      hint: null,
      difficultyScore: 2,
    },
  },
  ...overrides,
});

// Submit payload defaults mirror the canonical practice-room happy path so tests only override fields under scrutiny.
export const buildSubmitAttemptPayload = (
  overrides: Partial<SubmitAttemptDto> = {},
): SubmitAttemptDto => ({
  moduleUnitId: TEST_MODULE_UNIT_ID,
  questionUnitId: TEST_QUESTION_UNIT_ID,
  questionContentId: TEST_QUESTION_CONTENT_ID,
  sessionId: TEST_SESSION_ID,
  timeTakenMs: 1500,
  hintUnlocked: false,
  studentAnswer: { selectedOptionIndex: 1 },
  ...overrides,
});
