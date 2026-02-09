// Provides one MSW server instance for all unit tests to ensure deterministic network mocking.
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Reuse a shared server to avoid per-file lifecycle drift and flaky tests.
export const server = setupServer(...handlers);
