/*
 * Date and time utility helpers for date boundary calculations.
 */
export const DateHelpers = {
  /**
   * Returns the start of the UTC day and the start of the next UTC day for a given timestamp.
   * Useful for querying date ranges in Prisma.
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
};
