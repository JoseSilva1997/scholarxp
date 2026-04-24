// Normalizes string ids so hooks can branch cleanly between draft and persisted entities.
export const toPersistedId = (id: string): number | null => {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
};
