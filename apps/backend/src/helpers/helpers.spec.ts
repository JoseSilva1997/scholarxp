// Verifies timezone day-bound helpers stay exact for minute/second values that previously corrupted local midnight math.
import { DateHelpers } from './helpers';

describe('DateHelpers.getLocalDayBounds', () => {
  it('keeps full minute precision when deriving UTC midnight', () => {
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      new Date('2026-03-13T12:30:00.000Z'),
      'UTC',
    );

    expect(dayStartUtc.toISOString()).toBe('2026-03-13T00:00:00.000Z');
    expect(nextDayStartUtc.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });

  it('does not corrupt minute values that are exact multiples of twenty-four', () => {
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      new Date('2026-03-13T12:24:48.000Z'),
      'UTC',
    );

    expect(dayStartUtc.toISOString()).toBe('2026-03-13T00:00:00.000Z');
    expect(nextDayStartUtc.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });

  it('still returns the correct UTC window for non-UTC timezones', () => {
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      new Date('2026-07-10T12:48:24.000Z'),
      'Europe/London',
    );

    expect(dayStartUtc.toISOString()).toBe('2026-07-09T23:00:00.000Z');
    expect(nextDayStartUtc.toISOString()).toBe('2026-07-10T23:00:00.000Z');
  });
});
