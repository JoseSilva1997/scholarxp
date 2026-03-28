// Central query-key registry so related screens invalidate and read the same cache entries.
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  invites: {
    redeem: (token: string) => ['invites', 'redeem', token] as const,
  },
  modules: {
    all: ['modules'] as const,
    detail: (moduleId: number) => ['modules', 'detail', moduleId] as const,
    units: (moduleId: number) => ['modules', 'units', moduleId] as const,
    invites: (moduleId: number) => ['modules', 'invites', moduleId] as const,
    // Session id is included so switching/replacing URL session ids triggers a room refetch.
    moduleUnitPracticeRoom: (
      moduleId: number,
      unitId: number,
      sessionId?: string,
      sessionType?: string,
    ) =>
      [
        'modules',
        'practice-room',
        moduleId,
        unitId,
        sessionId ?? 'new',
        sessionType ?? 'default',
      ] as const,
    moduleUnitPracticeRoomBase: (moduleId: number, unitId: number) =>
      ['modules', 'practice-room', moduleId, unitId] as const,
    // Session id is part of the key so resumed daily-practice sessions can refetch the right room envelope.
    dailyPractice: (moduleId: number, sessionId?: string) =>
      ['modules', 'daily-practice', moduleId, sessionId ?? 'new'] as const,
    dailyPracticeBase: (moduleId: number) =>
      ['modules', 'daily-practice', moduleId] as const,
  },
  quests: {
    all: ['quests'] as const,
    history: (dayLimit: number) => ['quests', 'history', dayLimit] as const,
    todaySummary: (userId: number | null) => ['quests', 'today-summary', userId] as const,
    todayList: (userId: number | null) => ['quests', 'today-list', userId] as const,
    masterStreakAll: ['quests', 'master-streak'] as const,
    masterStreak: (userId: number | null) =>
      ['quests', 'master-streak', userId] as const,
  },
  rewards: {
    all: ['rewards'] as const,
    dailyLessonXpTrackAll: ['rewards', 'daily-lesson-xp-track'] as const,
    dailyLessonXpTrack: (userId: number | null) =>
      ['rewards', 'daily-lesson-xp-track', userId] as const,
  },
  roster: {
    summary: (moduleId: number) => ['roster', 'summary', moduleId] as const,
    students: (moduleId: number) => ['roster', 'students', moduleId] as const,
    lessons: (moduleId: number) => ['roster', 'lessons', moduleId] as const,
    review: (moduleId: number) => ['roster', 'review', moduleId] as const,
    studentDetail: (moduleId: number, studentId: number) =>
      ['roster', 'student-detail', moduleId, studentId] as const,
  },
  profile: {
    student: (userId: number | null) => ['profile', 'student', userId] as const,
    tutor: (userId: number | null) => ['profile', 'tutor', userId] as const,
  },
};
