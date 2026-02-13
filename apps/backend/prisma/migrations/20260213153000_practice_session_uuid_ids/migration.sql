-- Migrates practice session identifiers from integer PKs to UUIDs and updates question-attempt session FKs.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "practice_sessions"
ADD COLUMN "id_new" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "question_attempts"
ADD COLUMN "session_id_new" UUID;

UPDATE "question_attempts" AS qa
SET "session_id_new" = ps."id_new"
FROM "practice_sessions" AS ps
WHERE qa."session_id" = ps."id";

ALTER TABLE "question_attempts"
DROP CONSTRAINT IF EXISTS "question_attempts_session_id_fkey";

DROP INDEX IF EXISTS "question_attempts_session_id_idx";

ALTER TABLE "question_attempts"
DROP COLUMN "session_id";

ALTER TABLE "practice_sessions"
DROP CONSTRAINT "practice_sessions_pkey";

ALTER TABLE "practice_sessions"
DROP COLUMN "id";

ALTER TABLE "practice_sessions"
RENAME COLUMN "id_new" TO "id";

ALTER TABLE "practice_sessions"
ADD CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id");

ALTER TABLE "question_attempts"
RENAME COLUMN "session_id_new" TO "session_id";

ALTER TABLE "question_attempts"
ADD CONSTRAINT "question_attempts_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "question_attempts_session_id_idx"
ON "question_attempts"("session_id");
