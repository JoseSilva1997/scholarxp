// Registers common test runtime behavior (DOM matchers + network mocks) for every suite.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/shared/test/server';

// Provide matchMedia in jsdom so ThemeProvider can subscribe to system color-scheme changes.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
    addListener: () => undefined,
    removeListener: () => undefined,
  }),
});

class MockIntersectionObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }

  takeRecords() {
    return [];
  }
}

// Route tests only need the observer contract to exist; visibility-driven animation timing is not the unit under test.
Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Start once so tests can opt into request mocks while still failing fast on unhandled calls.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  // Reset request handlers between tests so one suite never leaks behavior into another.
  server.resetHandlers();
  // Ensure each test starts from a clean DOM so selectors never collide across suites.
  cleanup();
});

afterAll(() => {
  server.close();
});
