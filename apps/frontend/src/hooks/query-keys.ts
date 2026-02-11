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
    // Module-unit-scoped practice room key is intentionally distinct from future session-scoped room keys.
    moduleUnitPracticeRoom: (moduleId: number, unitId: number) =>
      ['modules', 'practice-room', moduleId, unitId] as const,
  },
};
