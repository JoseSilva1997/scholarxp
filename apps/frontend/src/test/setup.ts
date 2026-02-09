// Registers common test runtime behavior (DOM matchers + network mocks) for every suite.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

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
