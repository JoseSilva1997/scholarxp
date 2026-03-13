// Central query-key registry so related screens invalidate and read the same cache entries.
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
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
    ) => ['modules', 'practice-room', moduleId, unitId, sessionId ?? 'new'] as const,
    moduleUnitPracticeRoomBase: (moduleId: number, unitId: number) =>
      ['modules', 'practice-room', moduleId, unitId] as const,
  },
  quests: {
    all: ['quests'] as const,
    history: (dayLimit: number) => ['quests', 'history', dayLimit] as const,
    todaySummary: (userId: number | null) => ['quests', 'today-summary', userId] as const,
    todayList: (userId: number | null) => ['quests', 'today-list', userId] as const,
  },
};
