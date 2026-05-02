// Central query-key registry so related screens invalidate and read the same cache entries.
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  invites: {
    // Token-scoped redemption keys prevent one invite preview from populating another invite's cache.
    redeem: (token: string) => ['invites', 'redeem', token] as const,
  },
  modules: {
    all: ['modules'] as const,
    // Module id partitions detail caches for tutor and student module views.
    detail: (moduleId: number) => ['modules', 'detail', moduleId] as const,
    // Unit lists are tied to a module so edits invalidate only the affected course structure.
    units: (moduleId: number) => ['modules', 'units', moduleId] as const,
    // Invite panels cache independently per module because invite tokens are module-owned.
    invites: (moduleId: number) => ['modules', 'invites', moduleId] as const,
    // Deletion previews are module-specific and should not share data across settings panels.
    deletionImpact: (moduleId: number) =>
      ['modules', 'deletion-impact', moduleId] as const,
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
    // Base key supports invalidating all practice-room sessions for a unit after progress changes.
    moduleUnitPracticeRoomBase: (moduleId: number, unitId: number) =>
      ['modules', 'practice-room', moduleId, unitId] as const,
    // Session id is part of the key so resumed daily-practice sessions can refetch the right room envelope.
    dailyPractice: (moduleId: number, sessionId?: string) =>
      ['modules', 'daily-practice', moduleId, sessionId ?? 'new'] as const,
    // Base key supports broad invalidation when a daily-practice action affects all sessions for a module.
    dailyPracticeBase: (moduleId: number) =>
      ['modules', 'daily-practice', moduleId] as const,
  },
  quests: {
    all: ['quests'] as const,
    // History is keyed by requested window so short and long history views do not overwrite each other.
    history: (dayLimit: number) => ['quests', 'history', dayLimit] as const,
    // User id keeps quest summaries isolated when role switching or auth refresh changes the active user.
    todaySummary: (userId: number | null) => ['quests', 'today-summary', userId] as const,
    // Quest lists are user-scoped because completion state is personal rather than global.
    todayList: (userId: number | null) => ['quests', 'today-list', userId] as const,
    masterStreakAll: ['quests', 'master-streak'] as const,
    // Master streaks are user-scoped but share a parent key for broad quest invalidation.
    masterStreak: (userId: number | null) =>
      ['quests', 'master-streak', userId] as const,
  },
  rewards: {
    all: ['rewards'] as const,
    dailyLessonXpTrackAll: ['rewards', 'daily-lesson-xp-track'] as const,
    // User id prevents a cached pacing track from leaking across account changes.
    dailyLessonXpTrack: (userId: number | null) =>
      ['rewards', 'daily-lesson-xp-track', userId] as const,
    // Cosmetics mutations live under the same top-level bucket so future invalidation patterns can
    // target either track-related or cosmetic-related rewards without overlap.
    equipCosmetic: ['rewards', 'equip-cosmetic'] as const,
  },
  roster: {
    all: ['roster'] as const,
    // Summary data is scoped by module because roster analytics are module-owned.
    summary: (moduleId: number) => ['roster', 'summary', moduleId] as const,
    // Student lists are scoped by module enrollment.
    students: (moduleId: number) => ['roster', 'students', moduleId] as const,
    // Lesson analytics are scoped by module so the roster page can invalidate them separately.
    lessons: (moduleId: number) => ['roster', 'lessons', moduleId] as const,
    // Student drilldowns include both module and student to avoid mixing enrollment contexts.
    studentDetail: (moduleId: number, studentId: number) =>
      ['roster', 'student-detail', moduleId, studentId] as const,
    // Lesson drilldowns include both module and unit because unit ids are interpreted within module context.
    lessonDrilldown: (moduleId: number, moduleUnitId: number) =>
      ['roster', 'lesson-drilldown', moduleId, moduleUnitId] as const,
  },
  profile: {
    tutorAll: ['profile', 'tutor'] as const,
    // Student profile data is user-scoped so viewed profiles do not share cache entries.
    student: (userId: number | null) => ['profile', 'student', userId] as const,
    // Tutor profile data is user-scoped for the same reason as student profile data.
    tutor: (userId: number | null) => ['profile', 'tutor', userId] as const,
  },
};
