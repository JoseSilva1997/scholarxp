// Verifies PracticeRoomMapper keeps room payload shaping stable across core content and attempt edge cases.
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import { PracticeRoomMapper } from './practice-room.mapper';
import {
  buildLoadedModuleUnit,
  buildQuestionUnitDraft,
  TEST_MODULE_UNIT_ID,
  TEST_QUESTION_CONTENT_ID,
  TEST_QUESTION_UNIT_ID,
  TEST_SESSION_ID,
} from './practice-room.test-helpers';

describe('PracticeRoomMapper', () => {
  let mapper: PracticeRoomMapper;

  beforeEach(() => {
    mapper = new PracticeRoomMapper();
  });

  it('builds question-unit drafts from core content and skips units without core content', () => {
    const drafts = mapper.toQuestionUnitDrafts(
      buildLoadedModuleUnit({
        questionUnits: [
          {
            id: 1,
            contents: [
              {
                id: 11,
                isCore: false,
                type: 'mcq',
                questionStem: 'Variant only',
                questionData: {},
                hint: null,
              },
            ],
          },
          {
            id: 2,
            contents: [
              {
                id: 22,
                isCore: true,
                type: 'true_false',
                questionStem: 'Core question',
                questionData: { correctAnswer: true },
                hint: 'Think carefully',
              },
            ],
          },
        ],
      } as never),
    );

    expect(drafts).toEqual([
      {
        questionUnitId: 2,
        coreContentId: 22,
        coreQuestion: {
          questionId: 2,
          questionContent: {
            id: 22,
            type: 'true_false',
            questionStem: 'Core question',
            questionData: { correctAnswer: true },
            hint: 'Think carefully',
          },
        },
      },
    ]);
  });

  it('keeps the first latest-attempt snapshot for each question/content key', () => {
    const first = {
      questionId: 1,
      contentId: 2,
      studentAnswer: { selectedOptionIndex: 0 },
      isCorrect: false,
    };
    const duplicate = {
      questionId: 1,
      contentId: 2,
      studentAnswer: { selectedOptionIndex: 1 },
      isCorrect: true,
    };

    const result = mapper.toLatestAttemptMap([first, duplicate] as never);

    expect(result.get('1:2')).toBe(first);
  });

  it('builds a response with mapped attempts, reward state, progress, and streak metadata', () => {
    const attempt = {
      questionId: TEST_QUESTION_UNIT_ID,
      contentId: TEST_QUESTION_CONTENT_ID,
      studentAnswer: { selectedOptionIndex: 1 },
      isCorrect: true,
    };
    const rewardState = {
      baseQuestionExpStatus: 'already_earned' as const,
      firstAttemptBonusStatus: 'lost' as const,
    };

    const response = mapper.buildResponse({
      sessionId: TEST_SESSION_ID,
      sessionType: PracticeSessionTypeValues.practiceRoom,
      moduleUnitId: TEST_MODULE_UNIT_ID,
      moduleUnitTitle: 'Intro to Cells',
      isReadOnly: false,
      questionUnitDrafts: [buildQuestionUnitDraft()],
      latestAttemptByKey: mapper.toLatestAttemptMap([attempt] as never),
      questionRewardStateByQuestionId: new Map([
        [TEST_QUESTION_UNIT_ID, rewardState],
      ]),
      claimedStreakTiers: [3],
      moduleProgress: { moduleId: 1 } as never,
      currentStreak: 2,
      highestStreak: 5,
    });

    expect(response.practiceRoom.questions[0]).toEqual(
      expect.objectContaining({
        questionUnitId: TEST_QUESTION_UNIT_ID,
        position: 1,
        hasCorrectAttempt: true,
        rewardState,
      }),
    );
    expect(response.practiceRoom.questions[0].coreQuestion.lastAttempt).toEqual(
      {
        studentAnswer: { selectedOptionIndex: 1 },
        isCorrect: true,
      },
    );
    expect(response.moduleProgress).toEqual({ moduleId: 1 });
    expect(response.streakRewardState).toEqual({ claimedTiers: [3] });
    expect(response.currentStreak).toBe(2);
    expect(response.highestStreak).toBe(5);
  });

  it('uses default reward state and null attempt state when no attempt exists', () => {
    const response = mapper.buildResponse({
      sessionId: TEST_SESSION_ID,
      sessionType: PracticeSessionTypeValues.viewAnswers,
      moduleUnitId: TEST_MODULE_UNIT_ID,
      moduleUnitTitle: 'Intro to Cells',
      isReadOnly: true,
      questionUnitDrafts: [buildQuestionUnitDraft()],
      latestAttemptByKey: new Map(),
      questionRewardStateByQuestionId: new Map(),
      claimedStreakTiers: [],
    });

    expect(response.practiceRoom.isReadOnly).toBe(true);
    expect(response.practiceRoom.questions[0].hasCorrectAttempt).toBeNull();
    expect(response.practiceRoom.questions[0].rewardState).toEqual({
      baseQuestionExpStatus: 'available',
      firstAttemptBonusStatus: 'available',
    });
    expect(
      response.practiceRoom.questions[0].coreQuestion.lastAttempt,
    ).toBeNull();
  });
});
