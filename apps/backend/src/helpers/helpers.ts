/*
 * Date and time utility helpers for date boundary calculations.
 */
export const DateHelpers = {
  /**
   * Returns the start of the UTC day and the start of the next UTC day for a given timestamp.
   * Useful for querying date ranges in Prisma when the stored dates are already UTC-anchored.
   */
  getUtcDayBounds(timestamp: Date) {
    const dayStartUtc = new Date(
      Date.UTC(
        timestamp.getUTCFullYear(),
        timestamp.getUTCMonth(),
        timestamp.getUTCDate(),
      ),
    );
    const nextDayStartUtc = new Date(
      dayStartUtc.getTime() + 24 * 60 * 60 * 1000,
    );
    return {
      dayStartUtc,
      nextDayStartUtc,
    };
  },

  /**
   * Returns the YYYY-MM-DD date string as seen in the given IANA timezone.
   * Use this for @db.Date column lookups — those store the local calendar date, not a UTC date.
   */
  getLocalDateKey(timestamp: Date, timezone: string): string {
    // en-CA locale reliably formats as YYYY-MM-DD, which PostgreSQL DATE columns accept directly.
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
      timestamp,
    );
  },

  /**
   * Returns the UTC instants that bound the local calendar day for the given IANA timezone.
   * dayStartUtc / nextDayStartUtc are actual UTC millisecond boundaries, not local-midnight-as-UTC-midnight.
   * Use these for DateTime range queries (gte/lt) that must honour the user's local midnight.
   */
  getLocalDayBounds(
    timestamp: Date,
    timezone: string,
  ): { dayStartUtc: Date; nextDayStartUtc: Date } {
    // Finds the UTC instant of local midnight by subtracting the local clock time from the UTC timestamp.
    // Works across DST transitions because we measure elapsed local-time-of-day, not a fixed offset.
    const localMidnight = (t: Date): Date => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(t);

      const get = (type: string): number => {
        const part = parts.find((p) => p.type === type);
        // Some Intl implementations return '24' for midnight with hour12:false — normalise to 0.
        const value = parseInt(part?.value ?? '0', 10);
        return type === 'hour' ? value % 24 : value;
      };

      return new Date(
        t.getTime() -
          get('hour') * 3_600_000 -
          get('minute') * 60_000 -
          get('second') * 1_000 -
          t.getMilliseconds(),
      );
    };

    const dayStartUtc = localMidnight(timestamp);

    // Jump 30 h past the day start so we always land in the next local day regardless of DST (max ±2 h shift).
    const nextDayStartUtc = localMidnight(
      new Date(dayStartUtc.getTime() + 30 * 60 * 60 * 1_000),
    );

    return { dayStartUtc, nextDayStartUtc };
  },
};
