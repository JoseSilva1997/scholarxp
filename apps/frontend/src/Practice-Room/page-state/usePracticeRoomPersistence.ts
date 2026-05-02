// Manages localStorage persistence for the practice-room question-selection state.
// Owns the storage-key scheme, read/write logic, and data validation so those concerns
// stay out of the main page-state hook. Exposes initialSelection (for seeding useState
// lazy initializers) and a persistSelection callback (for the parent write effect).
import { useCallback, useMemo } from 'react';

export type PracticeRoomQuestionSelectionPersistence = {
  sessionId: string;
  selectedQuestionUnitIndex: number;
  unlockedHintByContentId: Record<number, boolean>;
  submittedByContentId: Record<number, boolean>;
};

type UsePracticeRoomPersistenceParams = {
  moduleId: number | null;
  unitId: number | null;
};

type UsePracticeRoomPersistenceResult = {
  // Synchronously read from localStorage on first render; used to seed the three
  // session-indexed useState calls so the room resumes where the student left off.
  initialSelection: PracticeRoomQuestionSelectionPersistence | null;
  // Stable callback — safe to call from a parent useEffect dependency array.
  // Writes the current selection snapshot to localStorage under the computed key.
  persistSelection: (snapshot: PracticeRoomQuestionSelectionPersistence) => void;
  // Exposed for the parent write-effect dependency array; null when ids are not yet resolved.
  storageKey: string | null;
};

// Provides validated localStorage persistence for session-specific question selection state.
export function usePracticeRoomPersistence({
  moduleId,
  unitId,
}: UsePracticeRoomPersistenceParams): UsePracticeRoomPersistenceResult {
  const storageKey = useMemo(
    () => buildPracticeRoomQuestionSelectionStorageKey(moduleId, unitId),
    [moduleId, unitId],
  );

  // Read is synchronous and memoized so the value is stable across renders with the
  // same key. The parent's useState lazy initializers can safely close over this value.
  const initialSelection = useMemo(
    () => (storageKey === null ? null : readPracticeRoomQuestionSelectionPersistence(storageKey)),
    [storageKey],
  );

  const persistSelection = useCallback(
    (snapshot: PracticeRoomQuestionSelectionPersistence) => {
      if (storageKey === null) return;
      writePracticeRoomQuestionSelectionPersistence(storageKey, snapshot);
    },
    [storageKey],
  );

  return { initialSelection, persistSelection, storageKey };
}

// --- Pure utilities ------------------------------------------------------------

// Builds the versioned localStorage key for one module-unit practice room.
function buildPracticeRoomQuestionSelectionStorageKey(
  moduleId: number | null,
  unitId: number | null,
): string | null {
  if (!moduleId || !unitId) return null;
  return `practice-room-question-selection-v1:${moduleId}:${unitId}`;
}

// Reads and validates a saved practice-room selection snapshot.
function readPracticeRoomQuestionSelectionPersistence(
  storageKey: string,
): PracticeRoomQuestionSelectionPersistence | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) return null;

  try {
    const parsedValue =
      JSON.parse(rawValue) as Partial<PracticeRoomQuestionSelectionPersistence>;
    if (
      typeof parsedValue.sessionId !== 'string' ||
      !isUuidString(parsedValue.sessionId)
    ) {
      return null;
    }
    if (
      typeof parsedValue.selectedQuestionUnitIndex !== 'number' ||
      parsedValue.selectedQuestionUnitIndex < 0
    ) {
      return null;
    }
    return {
      sessionId: parsedValue.sessionId,
      selectedQuestionUnitIndex: parsedValue.selectedQuestionUnitIndex,
      unlockedHintByContentId: sanitizePersistedBooleanByContentId(
        parsedValue.unlockedHintByContentId,
      ),
      submittedByContentId: sanitizePersistedBooleanByContentId(
        parsedValue.submittedByContentId,
      ),
    };
  } catch {
    return null;
  }
}

// Persists a practice-room selection snapshot using the caller's validated storage key.
function writePracticeRoomQuestionSelectionPersistence(
  storageKey: string,
  value: PracticeRoomQuestionSelectionPersistence,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

// Validates backend session identifiers before they are accepted from URLs or localStorage.
export function isUuidString(value: string): boolean {
  // UUID validation keeps URL and local persistence aligned with backend session-id constraints.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

// Converts persisted object data into a safe number-keyed boolean map.
function sanitizePersistedBooleanByContentId(value: unknown): Record<number, boolean> {
  if (!value || typeof value !== 'object') return {};

  const sanitized: Record<number, boolean> = {};
  for (const [rawContentId, rawFlag] of Object.entries(value)) {
    const contentId = Number(rawContentId);
    if (!Number.isInteger(contentId) || contentId <= 0) continue;
    if (typeof rawFlag !== 'boolean') continue;
    sanitized[contentId] = rawFlag;
  }
  return sanitized;
}
