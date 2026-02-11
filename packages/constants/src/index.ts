// Re-export constants from the canonical file so the package can be built
// and expose a stable `dist` entrypoint. Keeping the source constants
// in `constants.ts` to avoid changing existing imports in the repo.

// Re-export everything (values + types) so consumers can import both runtime
// constants and associated type aliases such as `PracticeMode`.
export * from '../constants';
