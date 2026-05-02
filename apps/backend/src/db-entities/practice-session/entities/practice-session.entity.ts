// Groups a set of question attempts under a single user session. The id is a UUID string (not
// an integer) to allow client-generated identifiers without a round-trip before recording attempts.
export class PracticeSession {
  // UUID; may be generated client-side before the session is persisted.
  id: string;
  moduleId: number;
  userId: number;
  startTime: Date;
  // Null while the session is still in progress; set when the user submits or abandons.
  endTime: Date | null;
}
