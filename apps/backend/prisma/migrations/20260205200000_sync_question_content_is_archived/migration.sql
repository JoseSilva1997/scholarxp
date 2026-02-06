-- Align question_content with code expectations: replace string status with boolean is_archived.
ALTER TABLE "question_content"
ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- Map legacy values if the old status column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_content' AND column_name = 'status'
  ) THEN
    UPDATE "question_content"
    SET "is_archived" = CASE
      WHEN status ILIKE 'archived' THEN true
      ELSE false
    END;
    ALTER TABLE "question_content" DROP COLUMN "status";
  END IF;
END $$;
