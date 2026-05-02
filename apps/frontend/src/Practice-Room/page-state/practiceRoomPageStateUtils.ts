// Shared utility helpers for practice-room page-state orchestration.
// This module centralizes session-scoped map operations and route-param parsing
// so the main page-state hook can stay focused on feature flow composition.
import type { PracticeRoomQuestionSelectionPersistence } from '@/Practice-Room/page-state/usePracticeRoomPersistence';

type SessionScopedMap<T> = Record<string, T>;

const EMPTY_BOOLEAN_BY_CONTENT_ID: Record<number, boolean> = {};

// Parses route parameters into positive integer ids before they are used in
// query keys or API payload wiring.
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


// Builds the initial session-scoped map from a persisted selection snapshot.
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


// Reads the current session value from a map with a typed fallback.
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

// Assigns one session-scoped value and preserves referential equality for no-op writes.
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

// Updates one session-scoped value when the next value depends on the current value.
export function updateSessionScopedValue<T>(
  previousValue: SessionScopedMap<T>,
  sessionId: string,
  updateValue: (currentValue: T | undefined) => T,
): SessionScopedMap<T> {
  const nextValue = updateValue(previousValue[sessionId]);
  return setSessionScopedValue(previousValue, sessionId, nextValue);
}

// Seeds a session-scoped value only once so optimistic updates remain authoritative afterward.
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

// Reports whether the active session has a stored value in the supplied map.
export function hasSessionScopedValue<T>(
  sessionId: string | null,
  valuesBySessionId: SessionScopedMap<T>,
): boolean {
  if (sessionId === null) {
    return false;
  }
  return valuesBySessionId[sessionId] !== undefined;
}

// Updates nested session/content boolean maps while preserving no-op referential equality.
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
