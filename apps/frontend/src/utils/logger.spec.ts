// Verifies the logger initializes Sentry defensively and preserves dev-console fallback behavior.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('@sentry/browser', () => sentryMocks);

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  it('does not initialize Sentry when no DSN is provided', async () => {
    const { initLogger, logMessage } = await import('@/utils/logger');

    initLogger({});
    logMessage('hello', { source: 'test' });

    expect(sentryMocks.init).not.toHaveBeenCalled();
    expect(sentryMocks.captureMessage).not.toHaveBeenCalled();
  });

  it('initializes Sentry once and captures errors/messages after initialization', async () => {
    const { initLogger, logError, logMessage } = await import('@/utils/logger');

    initLogger({ dsn: 'https://dsn.example', environment: 'test' });
    initLogger({ dsn: 'https://dsn.example', environment: 'test' });
    logError('boom', { feature: 'logger' });
    logMessage('careful', { feature: 'logger' }, 'warning');

    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
    expect(sentryMocks.init).toHaveBeenCalledWith({
      dsn: 'https://dsn.example',
      environment: 'test',
      release: undefined,
      tracesSampleRate: 0.05,
    });
    expect(sentryMocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { feature: 'logger' },
    });
    expect(sentryMocks.captureMessage).toHaveBeenCalledWith('careful', {
      level: 'warning',
      extra: { feature: 'logger' },
    });
  });

  it('routes dev-console message levels to the matching console method', async () => {
    const { logMessage } = await import('@/utils/logger');

    logMessage('bad', undefined, 'error');
    logMessage('trace', undefined, 'debug');
    logMessage('hello');

    expect(console.error).toHaveBeenCalledWith('[frontend-log:message]', 'bad', undefined);
    expect(console.debug).toHaveBeenCalledWith('[frontend-log:message]', 'trace', undefined);
    expect(console.info).toHaveBeenCalledWith('[frontend-log:message]', 'hello', undefined);
  });

  it('uses the provided trace sample rate when initializing', async () => {
    const { initLogger } = await import('@/utils/logger');

    initLogger({
      dsn: 'https://dsn.example',
      release: 'frontend@1.2.3',
      tracesSampleRate: 0.2,
    });

    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: 'frontend@1.2.3',
        tracesSampleRate: 0.2,
      }),
    );
  });
});
