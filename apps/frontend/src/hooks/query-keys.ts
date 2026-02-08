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
  },
};

