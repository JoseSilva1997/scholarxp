-- Migration role: add archive flags to question groups and questions so content can be hidden without hard deletes.
ALTER TABLE "module_unit_question_groups"
ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "question_unit"
ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;
