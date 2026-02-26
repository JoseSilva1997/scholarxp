-- Migration role: move attempt origin from question_attempts.practice_mode to practice_sessions.session_type.
ALTER TABLE "practice_sessions"
ADD COLUMN "session_type" TEXT NOT NULL DEFAULT 'practice_room';

ALTER TABLE "question_attempts"
DROP COLUMN "practice_mode",
ALTER COLUMN "session_id" SET NOT NULL;

ALTER TABLE "question_attempts"
DROP CONSTRAINT IF EXISTS "question_attempts_session_id_fkey";

ALTER TABLE "question_attempts"
ADD CONSTRAINT "question_attempts_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
