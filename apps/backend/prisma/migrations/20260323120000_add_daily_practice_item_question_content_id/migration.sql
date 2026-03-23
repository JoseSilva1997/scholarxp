-- Persist the exact content shown in each daily-practice item so variant rotation stays stable across refreshes.
ALTER TABLE "daily_practice_set_items"
ADD COLUMN "question_content_id" INTEGER;

UPDATE "daily_practice_set_items" AS "item"
SET "question_content_id" = "content"."id"
FROM "question_content" AS "content"
WHERE "content"."question_unit_id" = "item"."question_unit_id"
  AND "content"."is_core" = true;

ALTER TABLE "daily_practice_set_items"
ALTER COLUMN "question_content_id" SET NOT NULL;

CREATE INDEX "daily_practice_set_item_content_lookup_idx"
ON "daily_practice_set_items"("question_content_id");

ALTER TABLE "daily_practice_set_items"
ADD CONSTRAINT "daily_practice_set_items_question_content_id_fkey"
FOREIGN KEY ("question_content_id") REFERENCES "question_content"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
