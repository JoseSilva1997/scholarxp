import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Anchoring @ to src removes brittle relative-depth imports when files move between feature folders.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Use browser-like DOM APIs so page-state hooks and route-level units can execute realistically.
    environment: 'jsdom',
    setupFiles: './src/shared/test/setup.ts',
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/shared/test/**',
        'src/**/setup.{ts,tsx}',
        'src/vite-env.d.ts',
      ],
    },
    // Using ‘forks’ pool instead of default ‘threads’ because MSW 2+ patching global fetch
    // in multiple shared-worker threads can lead to worker deadlocks during startup.
    pool: 'forks',
  },
})
