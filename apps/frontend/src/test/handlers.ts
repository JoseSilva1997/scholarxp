// Centralizes request handlers so test suites can override API behavior without duplicating setup.
import { http, HttpResponse } from 'msw';

// Keep a default no-op handler list; individual tests can append specific mocks with server.use.
export const handlers = [
  http.get('/__health__', () => HttpResponse.json({ ok: true })),
];
