// Covers TypeScript decorator helper fallback branches for decorated classes that otherwise have no logic there.
import 'reflect-metadata';

const decoratedFiles = [
  './auth/auth.service',
  './auth/session.serializer',
  './auth/strategies/local.strategy',
  './daily-practice/daily-practice-eligibility.service',
  './daily-practice/daily-practice.service',
  './db-entities/email-verification-token/email-verification-token.service',
  './db-entities/exp-ledger/exp-ledger.service',
  './db-entities/module-invite/module-invite.service',
  './db-entities/module-unit/module-unit.controller',
  './db-entities/questions/question-unit/question-unit.service',
  './db-entities/users/users.service',
  './exp-engine/exp-question-context.service',
  './exp-engine/exp-streak.service',
  './exp-engine/rewards.controller',
  './mailer/mailer.service',
  './practice-room/practice-room.controller',
  './profile/profile.controller',
  './profile/student-profile.service',
  './rewards/rewards.controller',
  './roster/roster.controller',
];

const importedMetatypeFallbackCases = [
  {
    modulePath: './auth/session.serializer',
    mocks: [
      { path: './auth/auth.service', exports: { AuthService: undefined } },
    ],
  },
  {
    modulePath: './auth/strategies/local.strategy',
    mocks: [
      { path: './auth/auth.service', exports: { AuthService: undefined } },
    ],
  },
  {
    modulePath: './db-entities/module-unit/module-unit.controller',
    mocks: [
      {
        path: './db-entities/module-unit/module-unit.service',
        exports: { ModuleUnitService: undefined },
      },
      {
        path: './db-entities/questions/question-unit/question-unit.service',
        exports: { QuestionUnitService: undefined },
      },
      {
        path: './db-entities/module-unit-question-group/module-unit-question-group.service',
        exports: { ModuleUnitQuestionGroupService: undefined },
      },
      {
        path: './db-entities/module-unit/dto/update-module-unit.dto',
        exports: { UpdateModuleUnitDto: undefined },
      },
      {
        path: './db-entities/module-unit/dto/create-module-unit-minimal.dto',
        exports: { CreateModuleUnitMinimalDto: undefined },
      },
      {
        path: './db-entities/questions/question-unit/dto/create-question-with-content.dto',
        exports: { CreateQuestionWithContentDto: undefined },
      },
      {
        path: './db-entities/questions/question-unit/dto/create-variant-with-content.dto',
        exports: { CreateVariantWithContentDto: undefined },
      },
      {
        path: './db-entities/questions/question-content/dto/update-question-content.dto',
        exports: { UpdateQuestionContentDto: undefined },
      },
      {
        path: './db-entities/module-unit-question-group/dto/create-module-unit-question-group.dto',
        exports: { CreateModuleUnitQuestionGroupDto: undefined },
      },
      {
        path: './db-entities/module-unit-question-group/dto/update-module-unit-question-group-name.dto',
        exports: { UpdateModuleUnitQuestionGroupNameDto: undefined },
      },
    ],
  },
  {
    modulePath: './exp-engine/rewards.controller',
    mocks: [
      {
        path: './exp-engine/daily-lesson-xp-track.service',
        exports: { DailyLessonXpTrackService: undefined },
      },
    ],
  },
  {
    modulePath: './practice-room/practice-room.controller',
    mocks: [
      {
        path: './practice-room/practice-room.service',
        exports: { PracticeRoomService: undefined },
      },
      {
        path: './practice-room/dto/get-practice-room-params.dto',
        exports: { GetPracticeRoomParamsDto: undefined },
      },
      {
        path: './practice-room/dto/close-practice-room-session-params.dto',
        exports: { ClosePracticeRoomSessionParamsDto: undefined },
      },
      {
        path: './practice-room/dto/get-practice-room-query.dto',
        exports: { GetPracticeRoomQueryDto: undefined },
      },
      {
        path: './practice-room/dto/submit-attempt.dto',
        exports: { SubmitAttemptDto: undefined },
      },
    ],
  },
  {
    modulePath: './profile/profile.controller',
    mocks: [
      {
        path: './profile/student-profile.service',
        exports: { StudentProfileService: undefined },
      },
      {
        path: './profile/tutor-profile.service',
        exports: { TutorProfileService: undefined },
      },
    ],
  },
  {
    modulePath: './rewards/rewards.controller',
    mocks: [
      {
        path: './rewards/rewards.service',
        exports: { RewardsService: undefined },
      },
      {
        path: './rewards/dto/equip-cosmetic.dto',
        exports: { EquipCosmeticDto: undefined },
      },
    ],
  },
  {
    modulePath: './roster/roster.controller',
    mocks: [
      {
        path: './roster/roster.service',
        exports: { RosterService: undefined },
      },
      {
        path: './roster/dto/roster-params.dto',
        exports: {
          RosterLessonParamsDto: undefined,
          RosterModuleParamsDto: undefined,
          RosterStudentParamsDto: undefined,
        },
      },
      {
        path: './roster/dto/roster-query.dto',
        exports: {
          RosterLessonsQueryDto: undefined,
          RosterStudentsQueryDto: undefined,
        },
      },
    ],
  },
];

describe('decorator emit runtime fallback', () => {
  it.each(decoratedFiles)('%s loads without Reflect.decorate', (modulePath) => {
    const originalDecorate = Reflect.decorate;
    jest.resetModules();

    try {
      Reflect.decorate = undefined as never;
      expect(() => require(modulePath)).not.toThrow();
    } finally {
      Reflect.decorate = originalDecorate;
      jest.resetModules();
    }
  });

  it.each(importedMetatypeFallbackCases)(
    '$modulePath loads when imported metadata types are unavailable',
    ({ modulePath, mocks }) => {
      jest.resetModules();

      try {
        for (const mock of mocks) {
          jest.doMock(mock.path, () => mock.exports);
        }

        expect(() => require(modulePath)).not.toThrow();
      } finally {
        for (const mock of mocks) {
          jest.dontMock(mock.path);
        }
        jest.resetModules();
      }
    },
  );
});
