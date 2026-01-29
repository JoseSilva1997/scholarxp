// Provides a centralized, production-ready logging helper backed by Sentry with a safe fallback.
import * as Sentry from '@sentry/browser';

type LoggerInitOptions = {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
};

let isInitialized = false;

/**
 * Initializes Sentry if a DSN is provided; otherwise leaves logging as a no-op to avoid breaking prod.
 */
export function initLogger(options: LoggerInitOptions) {
  if (!options.dsn) return;
  if (isInitialized) return;
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    tracesSampleRate: options.tracesSampleRate ?? 0.05,
  });
  isInitialized = true;
}

/**
 * Capture an error with optional sanitized context. Avoid passing request/response bodies or PII.
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isInitialized) return;
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    extra: context,
  });
}

/**
 * Capture a non-exception message event for observability without throwing.
 */
export function logMessage(
  message: string,
  context?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info',
): void {
  if (!isInitialized) return;
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}
