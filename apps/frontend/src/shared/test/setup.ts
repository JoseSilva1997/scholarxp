// Registers common test runtime behavior (DOM matchers + network mocks) for every suite.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/shared/test/server';

// Provide matchMedia in jsdom so ThemeProvider can subscribe to system color-scheme changes.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  // Provides the subset of MediaQueryList behavior needed by theme tests in jsdom.
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    // Listener stubs preserve the browser API contract without introducing asynchronous behavior.
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
    addListener: () => undefined,
    removeListener: () => undefined,
  }),
});

// Minimal IntersectionObserver test double for components that register visibility observers.
class MockIntersectionObserver {
  // Records no targets because visibility transitions are outside these unit-test responsibilities.
  observe() {
    return undefined;
  }

  // Mirrors the browser method so components can clean up observer targets during unmount.
  unobserve() {
    return undefined;
  }

  // Provides deterministic cleanup for components that disconnect observers in effects.
  disconnect() {
    return undefined;
  }

  // Returns an empty queue because tests do not simulate intersection entries globally.
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

// Releases the shared MSW server after the Vitest process finishes all suites.
afterAll(() => {
  server.close();
});
