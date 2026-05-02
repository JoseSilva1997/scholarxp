// Manages the practice-room session lifecycle: closing the active session on unmount
// and on the browser's pagehide event via a keepalive fetch fallback. Isolated here so
// the teardown concerns don't inflate the main page-state hook.
import { useEffect, useRef } from 'react';
import { closePracticeRoomSessionKeepalive } from '@/Authoring/api/modules';
import { shouldLogApiError } from '@/shared/api/get-display-error';
import { logError } from '@/utils/logger';

// Narrow callback type matching what TanStack Query's mutate exposes for the close-session mutation.
type CloseSessionFn = (
  sessionId: string,
  options: { onError: (error: unknown) => void },
) => void;

type UseSessionLifecycleParams = {
  sessionId: string | null;
  moduleId: number | null;
  unitId: number | null;
  // The TanStack Query mutate function for closing a session — passed in so this hook
  // doesn't need to know which query key or how the mutation is wired.
  closeSession: CloseSessionFn;
};

// Registers best-effort teardown behavior for the active practice-room session.
export function useSessionLifecycle({
  sessionId,
  moduleId,
  unitId,
  closeSession,
}: UseSessionLifecycleParams): void {
  // Refs keep the latest values accessible inside the stable pagehide/unmount callbacks
  // without forcing those callbacks to re-register on every render.
  const latestSessionIdRef = useRef<string | null>(sessionId);
  const latestModuleIdRef = useRef<number | null>(moduleId);
  const latestUnitIdRef = useRef<number | null>(unitId);
  const closeSessionRef = useRef<CloseSessionFn>(closeSession);
  // Tracks which sessions have already been sent a close request so we never double-close
  // (e.g., unmount fires after pagehide on navigation-away).
  const closedSessionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    latestSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    latestModuleIdRef.current = moduleId;
    latestUnitIdRef.current = unitId;
  }, [moduleId, unitId]);

  useEffect(() => {
    // Keep the latest mutate reference so teardown handlers don't capture a stale closure.
    closeSessionRef.current = closeSession;
  }, [closeSession]);

  useEffect(() => {
    // Attempts to close the latest active session exactly once, using keepalive
    // transport during page unload and the normal mutation path otherwise.
    const closeSessionBestEffort = (source: 'unmount' | 'pagehide') => {
      const currentSessionId = latestSessionIdRef.current;
      const currentModuleId = latestModuleIdRef.current;
      const currentUnitId = latestUnitIdRef.current;
      if (!currentSessionId || currentModuleId === null || currentUnitId === null) {
        return;
      }
      if (closedSessionIdsRef.current.has(currentSessionId)) {
        return;
      }
      closedSessionIdsRef.current.add(currentSessionId);

      // On pagehide the fetch stack may be torn down; try a keepalive fetch first so
      // the close request survives page unload. Fall back to the mutation for normal navigation.
      if (
        source === 'pagehide' &&
        closePracticeRoomSessionKeepalive(currentModuleId, currentUnitId, currentSessionId)
      ) {
        return;
      }

      closeSessionRef.current(currentSessionId, {
        onError: (error) => {
          // Allow retry through a later fallback trigger if close fails during teardown.
          closedSessionIdsRef.current.delete(currentSessionId);
          if (shouldLogApiError(error)) {
            logError(error, {
              feature: 'practice-room',
              action: 'close-session',
              moduleId: currentModuleId,
              unitId: currentUnitId,
            });
          }
        },
      });
    };

    // Handles browser navigation-away events where React unmount timing is not guaranteed.
    const handlePageHide = () => {
      closeSessionBestEffort('pagehide');
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      closeSessionBestEffort('unmount');
    };
  }, []);
}
