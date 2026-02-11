-- Migration role: link question attempts to practice sessions for per-session analytics and submit-attempt flow.
ALTER TABLE "question_attempts"
ADD COLUMN IF NOT EXISTS "session_id" INTEGER;

CREATE INDEX IF NOT EXISTS "question_attempts_session_id_idx"
ON "question_attempts" ("session_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'question_attempts_session_id_fkey'
  ) THEN
    ALTER TABLE "question_attempts"
    ADD CONSTRAINT "question_attempts_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
