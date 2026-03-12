// Shared utility helpers for practice-room page-state orchestration.
// This module centralizes session-scoped map operations and route-param parsing
// so the main page-state hook can stay focused on feature flow composition.
import type { PracticeRoomQuestionSelectionPersistence } from './usePracticeRoomPersistence';

type SessionScopedMap<T> = Record<string, T>;

const EMPTY_BOOLEAN_BY_CONTENT_ID: Record<number, boolean> = {};

// Route params are user-controlled strings; this parser guarantees positive-integer ids
// before those values are used in query keys and API payload wiring.
export function parsePositiveIntegerParam(rawParam: string | undefined): number | null {
  if (!rawParam) {
    return null;
  }
  const value = Number(rawParam);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

// Session-scoped state maps all share the same "sessionId -> value" shape.
// This builder keeps the localStorage bootstrap logic in one place.
export function buildInitialSessionScopedState<T>(
  initialSelection: PracticeRoomQuestionSelectionPersistence | null,
  valueSelector: (selection: PracticeRoomQuestionSelectionPersistence) => T,
): SessionScopedMap<T> {
  if (!initialSelection) {
    return {};
  }
  return {
    [initialSelection.sessionId]: valueSelector(initialSelection),
  };
}

// Reads the current session value from a map with a typed fallback so callers
// can avoid repeating null-check + index + default patterns.
export function readSessionScopedValue<T>(
  sessionId: string | null,
  valuesBySessionId: SessionScopedMap<T>,
  fallbackValue: T,
): T {
  if (sessionId === null) {
    return fallbackValue;
  }
  return valuesBySessionId[sessionId] ?? fallbackValue;
}

// Single assignment helper for session maps. It preserves referential equality when
// no change is needed, which prevents unnecessary rerenders for identical writes.
export function setSessionScopedValue<T>(
  previousValue: SessionScopedMap<T>,
  sessionId: string,
  nextValue: T,
): SessionScopedMap<T> {
  if (Object.is(previousValue[sessionId], nextValue)) {
    return previousValue;
  }
  return {
    ...previousValue,
    [sessionId]: nextValue,
  };
}

// Functional update helper for session maps where the next value depends on current.
export function updateSessionScopedValue<T>(
  previousValue: SessionScopedMap<T>,
  sessionId: string,
  updateValue: (currentValue: T | undefined) => T,
): SessionScopedMap<T> {
  const nextValue = updateValue(previousValue[sessionId]);
  return setSessionScopedValue(previousValue, sessionId, nextValue);
}

// Streak maps are seeded from the first room payload exactly once. Once seeded, the
// local optimistic updates should remain authoritative for that session lifecycle.
export function seedSessionScopedValue<T>(
  previousValue: SessionScopedMap<T>,
  sessionId: string,
  seedValue: T,
): SessionScopedMap<T> {
  if (previousValue[sessionId] !== undefined) {
    return previousValue;
  }
  return {
    ...previousValue,
    [sessionId]: seedValue,
  };
}

// Used by the page return object to report whether the session has been initialized.
export function hasSessionScopedValue<T>(
  sessionId: string | null,
  valuesBySessionId: SessionScopedMap<T>,
): boolean {
  if (sessionId === null) {
    return false;
  }
  return valuesBySessionId[sessionId] !== undefined;
}

// Nested maps track per-content booleans within each session. This helper centralizes
// immutable updates and short-circuits no-op writes.
export function setSessionScopedBooleanValue(
  previousValue: SessionScopedMap<Record<number, boolean>>,
  sessionId: string,
  contentId: number,
  nextFlag: boolean,
): SessionScopedMap<Record<number, boolean>> {
  const currentSessionValues = previousValue[sessionId] ?? EMPTY_BOOLEAN_BY_CONTENT_ID;
  if (currentSessionValues[contentId] === nextFlag) {
    return previousValue;
  }
  return {
    ...previousValue,
    [sessionId]: {
      ...currentSessionValues,
      [contentId]: nextFlag,
    },
  };
}

