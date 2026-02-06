-- Migration role: enforce module-unit group name uniqueness only for active (non-archived) rows.
ALTER TABLE "module_unit_question_groups"
DROP CONSTRAINT IF EXISTS "module_unit_question_groups_module_unit_id_name_key";

DROP INDEX IF EXISTS "module_unit_question_groups_module_unit_id_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "module_unit_question_groups_active_name_unique"
ON "module_unit_question_groups" ("module_unit_id", "name")
WHERE "is_archived" = false;
