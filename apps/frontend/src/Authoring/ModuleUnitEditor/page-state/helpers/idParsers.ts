// Normalizes string ids so hooks can branch cleanly between draft and persisted entities.
// Converts a local string id into a backend id, returning null for draft identifiers.
export const toPersistedId = (id: string): number | null => {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
};
