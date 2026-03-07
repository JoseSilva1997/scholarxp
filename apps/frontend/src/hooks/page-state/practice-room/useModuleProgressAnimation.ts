// Owns all module-XP progress animation state for the practice room: server sync,
// smooth bar animation, XP gain chip, and level-up celebration. Isolated here so the
// main page-state hook only has to pass in server data and call applyExpAward on submit.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';

// Minimal slice of the module detail query result that this hook needs — avoids
// importing the full response type just for three fields.
export type ProgressModuleDetail = {
  userModuleLevel?: number;
  currentExp?: number | null;
  expMax?: number | null;
};

type ModuleProgress = {
  level: number;
  currentExp: number;
  expPercent: number;
};

type ModuleProgressAnimationSnapshot = {
  totalExp: number;
  expMax: number;
};

type UseModuleProgressAnimationParams = {
  moduleDetail: ProgressModuleDetail | null;
  moduleId: number | null;
};

type UseModuleProgressAnimationResult = {
  moduleProgress: ModuleProgress | null;
  moduleExpGainIndicator: number | null;
  showLevelUp: boolean;
  // True once the first server snapshot has been applied; used by the parent to gate
  // the loading state so the progress bar doesn't flash empty on mount.
  isProgressInitialized: boolean;
  // Called by the submit handler after a successful attempt award. Encapsulates the
  // double-count guard, level-up celebration, and XP gain chip so those details
  // don't leak back into the parent hook.
  applyExpAward: (
    moduleExpAwarded: number,
    currentModuleDetail: ProgressModuleDetail | null,
  ) => void;
};

export function useModuleProgressAnimation({
  moduleDetail,
  moduleId,
}: UseModuleProgressAnimationParams): UseModuleProgressAnimationResult {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [moduleExpGainIndicator, setModuleExpGainIndicator] = useState<number | null>(null);
  const [moduleProgressAnimation, setModuleProgressAnimation] =
    useState<ModuleProgressAnimationSnapshot | null>(null);
  const [displayedModuleTotalExp, setDisplayedModuleTotalExp] = useState<number | null>(null);

  const displayedModuleTotalExpRef = useRef<number | null>(null);
  const moduleProgressAnimationFrameRef = useRef<number | null>(null);
  const moduleProgressAnimationFrameTargetRef = useRef<number | null>(null);
  const moduleProgressSyncFrameRef = useRef<number | null>(null);
  const moduleExpGainIndicatorTimeoutRef = useRef<number | null>(null);
  const levelUpVisibilityTimeoutRef = useRef<number | null>(null);
  const moduleProgressScopeRef = useRef<string | null>(null);
  // Tracks the last known level so we only show the level-up banner on genuine transitions.
  const prevLevelRef = useRef<number | undefined>(undefined);

  // Centralised celebration helper so both the server-sync effect and applyExpAward
  // trigger the level-up banner through one consistent path. Always advances prevLevelRef
  // so the next comparison starts from the correct baseline regardless of whether a
  // celebration was shown.
  const triggerLevelUpCelebration = useCallback(
    (previousLevel: number | undefined, nextLevel: number) => {
      prevLevelRef.current = nextLevel;
      if (previousLevel === undefined || nextLevel <= previousLevel) return;
      setShowLevelUp(true);
      if (levelUpVisibilityTimeoutRef.current !== null) {
        clearTimeout(levelUpVisibilityTimeoutRef.current);
      }
      levelUpVisibilityTimeoutRef.current = window.setTimeout(() => {
        setShowLevelUp(false);
        levelUpVisibilityTimeoutRef.current = null;
      }, 3000);
    },
    [],
  );

  // Cancel all pending animation frames and timeouts when the room unmounts to prevent
  // setState calls on unmounted components.
  useEffect(
    () => () => {
      if (moduleProgressAnimationFrameRef.current !== null) {
        cancelAnimationFrame(moduleProgressAnimationFrameRef.current);
      }
      if (moduleProgressSyncFrameRef.current !== null) {
        cancelAnimationFrame(moduleProgressSyncFrameRef.current);
      }
      if (moduleExpGainIndicatorTimeoutRef.current !== null) {
        clearTimeout(moduleExpGainIndicatorTimeoutRef.current);
      }
      if (levelUpVisibilityTimeoutRef.current !== null) {
        clearTimeout(levelUpVisibilityTimeoutRef.current);
      }
    },
    [],
  );

  // Sync progress from the server whenever the query resolves with a higher total XP
  // or when switching to a new module (scope change).
  useEffect(() => {
    if (!moduleDetail || !moduleId) {
      return;
    }

    const expMax =
      moduleDetail.expMax && moduleDetail.expMax > 0 ? moduleDetail.expMax : MODULE_UNIT_BASELINE_EXP;
    const currentExp = moduleDetail.currentExp ?? 0;
    const level = moduleDetail.userModuleLevel;

    if (level === undefined) {
      return;
    }

    const scopeKey = String(moduleId);
    const serverTotalExp = toModuleTotalExp(level, currentExp, expMax);
    const isNewScope = moduleProgressScopeRef.current !== scopeKey;
    const hasNoAnimationSnapshot = moduleProgressAnimation === null;
    const shouldSyncFromServer =
      isNewScope ||
      hasNoAnimationSnapshot ||
      serverTotalExp > moduleProgressAnimation.totalExp;

    if (!shouldSyncFromServer) {
      return;
    }

    moduleProgressScopeRef.current = scopeKey;
    // Deferring state updates avoids sync effect-write churn while still keeping progress
    // tied to the latest server truth.
    if (moduleProgressSyncFrameRef.current !== null) {
      cancelAnimationFrame(moduleProgressSyncFrameRef.current);
    }
    moduleProgressSyncFrameRef.current = requestAnimationFrame(() => {
      const { level: nextLevel } = fromModuleTotalExp(serverTotalExp, expMax);
      // Celebrate level-up only on server-driven progress jumps while already active in the room.
      triggerLevelUpCelebration(prevLevelRef.current, nextLevel);

      setModuleProgressAnimation({ totalExp: serverTotalExp, expMax });

      // Snapping is reserved for the initial room load or when switching modules.
      // For standard progress updates (XP gain), we leave the display value alone
      // so the animation effect can smoothly bridge the gap.
      if (isNewScope || hasNoAnimationSnapshot) {
        setDisplayedModuleTotalExp(serverTotalExp);
      }

      moduleProgressSyncFrameRef.current = null;
    });
  }, [moduleDetail, moduleId, moduleProgressAnimation, triggerLevelUpCelebration]);

  useEffect(() => {
    // Keep animation reads ref-based so the animation-loop effect can depend on the
    // target snapshot only, not the current display value, to avoid frame-restarts.
    displayedModuleTotalExpRef.current = displayedModuleTotalExp;
  }, [displayedModuleTotalExp]);

  // rAF-based animation loop — drives the smooth progress bar and XP text fill.
  useEffect(() => {
    if (!moduleProgressAnimation) {
      return;
    }

    const currentDisplayedModuleTotalExp = displayedModuleTotalExpRef.current;
    if (currentDisplayedModuleTotalExp === null) {
      // First boot: set immediately so the starting UI matches the server state.
      // We wrap in rAF to ensure we don't conflict with pending render cycles.
      moduleProgressAnimationFrameRef.current = requestAnimationFrame(() => {
        displayedModuleTotalExpRef.current = moduleProgressAnimation.totalExp;
        setDisplayedModuleTotalExp(moduleProgressAnimation.totalExp);
        moduleProgressAnimationFrameTargetRef.current = moduleProgressAnimation.totalExp;
        moduleProgressAnimationFrameRef.current = null;
      });
      return;
    }

    // If the target hasn't changed, we don't need to restart the animation.
    // This check avoids the "stuttering" effect where animations restart every frame.
    if (moduleProgressAnimationFrameTargetRef.current === moduleProgressAnimation.totalExp) {
      return;
    }

    const animationStart = currentDisplayedModuleTotalExp;
    const animationDistance = Math.abs(moduleProgressAnimation.totalExp - animationStart);
    // Increased duration values to make the progress bar fill feel more substantial.
    const animationDurationMs = Math.max(400, Math.min(1600, animationDistance * 18));
    const animationDelta = moduleProgressAnimation.totalExp - animationStart;
    const startedAt = performance.now();

    moduleProgressAnimationFrameTargetRef.current = moduleProgressAnimation.totalExp;

    if (moduleProgressAnimationFrameRef.current !== null) {
      cancelAnimationFrame(moduleProgressAnimationFrameRef.current);
    }

    // The bar and XP text should move together so learners can immediately perceive gained progress.
    const step = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / animationDurationMs);
      const easedProgress = easeOutCubic(progress);
      const nextValue = Math.round(animationStart + animationDelta * easedProgress);

      displayedModuleTotalExpRef.current = nextValue;
      setDisplayedModuleTotalExp(nextValue);

      if (progress < 1) {
        moduleProgressAnimationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      moduleProgressAnimationFrameRef.current = null;
    };

    moduleProgressAnimationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (moduleProgressAnimationFrameRef.current !== null) {
        cancelAnimationFrame(moduleProgressAnimationFrameRef.current);
      }
    };
  }, [moduleProgressAnimation]); // Decoupled from displayedModuleTotalExp to avoid frame-restarts.

  const moduleProgress = useMemo<ModuleProgress | null>(() => {
    if (!moduleDetail || moduleDetail.userModuleLevel === undefined) {
      return null;
    }

    const expMax =
      moduleDetail.expMax && moduleDetail.expMax > 0 ? moduleDetail.expMax : MODULE_UNIT_BASELINE_EXP;
    const fallbackTotalExp = toModuleTotalExp(
      moduleDetail.userModuleLevel,
      moduleDetail.currentExp ?? 0,
      expMax,
    );
    const animatedTotalExp = displayedModuleTotalExp ?? fallbackTotalExp;
    const derivedProgress = fromModuleTotalExp(animatedTotalExp, expMax);
    const currentExp = derivedProgress.currentExp;
    const expPercent = expMax > 0 ? Math.min(100, Math.round((currentExp / expMax) * 100)) : 0;

    return {
      level: derivedProgress.level,
      currentExp,
      expPercent,
    };
  }, [displayedModuleTotalExp, moduleDetail]);

  useEffect(() => {
    if (moduleProgress?.level === undefined) {
      return;
    }
    // Ref-only sync keeps event-path comparisons correct after room reloads/refetches.
    prevLevelRef.current = moduleProgress.level;
  }, [moduleProgress?.level]);

  // Called by the submit handler after a successful attempt award. Encapsulates the
  // double-count guard, level-up trigger, and XP gain chip so those concerns stay
  // inside this hook and don't bleed back into the parent.
  const applyExpAward = useCallback(
    (moduleExpAwarded: number, currentModuleDetail: ProgressModuleDetail | null) => {
      const currentExpMax =
        currentModuleDetail?.expMax && currentModuleDetail.expMax > 0
          ? currentModuleDetail.expMax
          : MODULE_UNIT_BASELINE_EXP;

      // Compute the server baseline before the mutation so the animation target lands
      // at exactly the right value even if the background refetch races the optimistic update.
      const baselineTotalExp =
        currentModuleDetail && currentModuleDetail.userModuleLevel !== undefined
          ? toModuleTotalExp(
              currentModuleDetail.userModuleLevel,
              currentModuleDetail.currentExp ?? 0,
              currentExpMax,
            )
          : // Fall back to the current animation snapshot when module detail isn't loaded yet.
            (moduleProgressAnimation?.totalExp ?? displayedModuleTotalExpRef.current ?? 0);

      const targetTotalExp = baselineTotalExp + moduleExpAwarded;

      setModuleProgressAnimation((previousValue) => {
        // If the animation target is already at or beyond our target (likely from the server
        // refetch sync), avoid adding the award a second time to prevent the "double-count" bug.
        if (previousValue && previousValue.totalExp >= targetTotalExp) {
          return previousValue;
        }

        const previousLevel =
          prevLevelRef.current ??
          fromModuleTotalExp(previousValue?.totalExp ?? baselineTotalExp, currentExpMax).level;
        const { level: nextLevel } = fromModuleTotalExp(targetTotalExp, currentExpMax);

        // Trigger level-up feedback from the submit event and synchronize the level ref
        // so a secondary server-sync doesn't trigger a double celebration.
        triggerLevelUpCelebration(previousLevel, nextLevel);

        return { totalExp: targetTotalExp, expMax: currentExpMax };
      });

      setModuleExpGainIndicator(moduleExpAwarded);
      if (moduleExpGainIndicatorTimeoutRef.current !== null) {
        clearTimeout(moduleExpGainIndicatorTimeoutRef.current);
      }
      // The gain chip is intentionally brief so it celebrates progress without cluttering the header.
      moduleExpGainIndicatorTimeoutRef.current = window.setTimeout(() => {
        setModuleExpGainIndicator(null);
        moduleExpGainIndicatorTimeoutRef.current = null;
      }, 1400);
    },
    // moduleProgressAnimation is read via closure inside setModuleProgressAnimation's
    // functional updater, so the ref fallback covers stale closure risk on the ref path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [triggerLevelUpCelebration],
  );

  return {
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    isProgressInitialized: moduleProgressAnimation !== null,
    applyExpAward,
  };
}

// --- Pure utilities ------------------------------------------------------------

function toModuleTotalExp(level: number, currentExp: number, expMax: number): number {
  // Total-exp normalisation lets us animate across level boundaries without special-case branching.
  return Math.max(0, level - 1) * expMax + Math.max(0, currentExp);
}

function fromModuleTotalExp(
  totalExp: number,
  expMax: number,
): { level: number; currentExp: number } {
  if (expMax <= 0) {
    return { level: 1, currentExp: 0 };
  }
  const safeTotalExp = Math.max(0, totalExp);
  return {
    level: Math.floor(safeTotalExp / expMax) + 1,
    currentExp: safeTotalExp % expMax,
  };
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}
