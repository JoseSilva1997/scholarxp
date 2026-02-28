// Verifies storage-key generation, localStorage round-tripping, and validation
// logic in usePracticeRoomPersistence so the practice room resumes correctly
// after a hard reload and never reads back malformed data.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  isUuidString,
  usePracticeRoomPersistence,
} from './usePracticeRoomPersistence';
import type { PracticeRoomQuestionSelectionPersistence } from './usePracticeRoomPersistence';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_KEY = 'practice-room-question-selection-v1:1:2';

const VALID_SNAPSHOT: PracticeRoomQuestionSelectionPersistence = {
  sessionId: VALID_UUID,
  selectedQuestionUnitIndex: 2,
  unlockedHintByContentId: { 10: true },
  submittedByContentId: { 10: true, 11: true },
};

// Reset localStorage before each test so stored values don't bleed across cases.
beforeEach(() => {
  localStorage.clear();
});

// ─── isUuidString ─────────────────────────────────────────────────────────────

describe('isUuidString', () => {
  it('returns true for a valid v4 UUID', () => {
    expect(isUuidString(VALID_UUID)).toBe(true);
  });

  it('returns true for an uppercase UUID', () => {
    expect(isUuidString(VALID_UUID.toUpperCase())).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isUuidString('')).toBe(false);
  });

  it('returns false for a string that is close but not a UUID', () => {
    expect(isUuidString('550e8400-e29b-41d4-a716-44665544000Z')).toBe(false);
  });

  it('returns false for a plain number string', () => {
    expect(isUuidString('12345')).toBe(false);
  });
});

// ─── storageKey ───────────────────────────────────────────────────────────────

describe('usePracticeRoomPersistence — storageKey', () => {
  it('returns null when moduleId is null', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: null, unitId: 2 }),
    );
    expect(result.current.storageKey).toBeNull();
  });

  it('returns null when unitId is null', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: null }),
    );
    expect(result.current.storageKey).toBeNull();
  });

  it('returns null when both ids are null', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: null, unitId: null }),
    );
    expect(result.current.storageKey).toBeNull();
  });

  it('returns the versioned key when both ids are provided', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.storageKey).toBe(VALID_KEY);
  });
});

// ─── initialSelection ─────────────────────────────────────────────────────────

describe('usePracticeRoomPersistence — initialSelection', () => {
  it('returns null when storageKey is null (missing ids)', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: null, unitId: null }),
    );
    expect(result.current.initialSelection).toBeNull();
  });

  it('returns null when localStorage has no entry for the key', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection).toBeNull();
  });

  it('returns null when localStorage contains invalid JSON', () => {
    localStorage.setItem(VALID_KEY, '{not-json}');
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection).toBeNull();
  });

  it('returns null when sessionId is not a valid UUID', () => {
    localStorage.setItem(
      VALID_KEY,
      JSON.stringify({ ...VALID_SNAPSHOT, sessionId: 'not-a-uuid' }),
    );
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection).toBeNull();
  });

  it('returns null when selectedQuestionUnitIndex is negative', () => {
    localStorage.setItem(
      VALID_KEY,
      JSON.stringify({ ...VALID_SNAPSHOT, selectedQuestionUnitIndex: -1 }),
    );
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection).toBeNull();
  });

  it('returns null when selectedQuestionUnitIndex is missing', () => {
    const rest: Omit<PracticeRoomQuestionSelectionPersistence, 'selectedQuestionUnitIndex'> = {
      sessionId: VALID_SNAPSHOT.sessionId,
      unlockedHintByContentId: VALID_SNAPSHOT.unlockedHintByContentId,
      submittedByContentId: VALID_SNAPSHOT.submittedByContentId,
    };
    localStorage.setItem(VALID_KEY, JSON.stringify(rest));
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection).toBeNull();
  });

  it('returns the parsed snapshot for valid stored data', () => {
    localStorage.setItem(VALID_KEY, JSON.stringify(VALID_SNAPSHOT));
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection).toEqual(VALID_SNAPSHOT);
  });

  it('strips non-boolean values from unlockedHintByContentId', () => {
    const dirty = {
      ...VALID_SNAPSHOT,
      // "hello" is invalid and should be stripped; 10: true should survive.
      unlockedHintByContentId: { 10: true, 11: 'hello', 12: 42 },
    };
    localStorage.setItem(VALID_KEY, JSON.stringify(dirty));
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection?.unlockedHintByContentId).toEqual({
      10: true,
    });
  });

  it('strips non-positive integer content ids from submittedByContentId', () => {
    const dirty = {
      ...VALID_SNAPSHOT,
      // 0 and -1 are invalid content ids and must be stripped.
      submittedByContentId: { 0: true, '-1': true, 5: true },
    };
    localStorage.setItem(VALID_KEY, JSON.stringify(dirty));
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection?.submittedByContentId).toEqual({
      5: true,
    });
  });

  it('handles missing boolean maps gracefully (defaults to empty objects)', () => {
    const minimal = {
      sessionId: VALID_UUID,
      selectedQuestionUnitIndex: 0,
    };
    localStorage.setItem(VALID_KEY, JSON.stringify(minimal));
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(result.current.initialSelection).toEqual({
      sessionId: VALID_UUID,
      selectedQuestionUnitIndex: 0,
      unlockedHintByContentId: {},
      submittedByContentId: {},
    });
  });
});

// ─── persistSelection ─────────────────────────────────────────────────────────

describe('usePracticeRoomPersistence — persistSelection', () => {
  it('writes serialized JSON to localStorage under the correct key', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    act(() => {
      result.current.persistSelection(VALID_SNAPSHOT);
    });
    const stored = localStorage.getItem(VALID_KEY);
    expect(stored).toBe(JSON.stringify(VALID_SNAPSHOT));
  });

  it('is a no-op when storageKey is null', () => {
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: null, unitId: null }),
    );
    act(() => {
      result.current.persistSelection(VALID_SNAPSHOT);
    });
    // Nothing should have been written.
    expect(localStorage.length).toBe(0);
  });

  it('overwrites a previously stored value', () => {
    localStorage.setItem(VALID_KEY, JSON.stringify(VALID_SNAPSHOT));
    const updated: PracticeRoomQuestionSelectionPersistence = {
      ...VALID_SNAPSHOT,
      selectedQuestionUnitIndex: 5,
    };
    const { result } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    act(() => {
      result.current.persistSelection(updated);
    });
    const stored = localStorage.getItem(VALID_KEY);
    expect(JSON.parse(stored!).selectedQuestionUnitIndex).toBe(5);
  });

  it('round-trips correctly: written data can be read back as initialSelection', () => {
    // First render: write.
    const { result: writeHook } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    act(() => {
      writeHook.current.persistSelection(VALID_SNAPSHOT);
    });

    // Second render (simulated remount): read.
    const { result: readHook } = renderHook(() =>
      usePracticeRoomPersistence({ moduleId: 1, unitId: 2 }),
    );
    expect(readHook.current.initialSelection).toEqual(VALID_SNAPSHOT);
  });
});
