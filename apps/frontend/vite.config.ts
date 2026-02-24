import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Use browser-like DOM APIs so page-state hooks and route-level units can execute realistically.
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    clearMocks: true,
    restoreMocks: true,
    // Using ‘forks’ pool instead of default ‘threads’ because MSW 2+ patching global fetch
    // in multiple shared-worker threads can lead to worker deadlocks during startup.
    pool: 'forks',
  },
})
