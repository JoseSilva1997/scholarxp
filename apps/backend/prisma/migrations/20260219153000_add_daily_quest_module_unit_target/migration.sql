-- Adds optional module-unit targeting to daily quests so unit-specific quests can be linked and validated.
ALTER TABLE "daily_quests"
ADD COLUMN "module_unit_id" INTEGER;

CREATE UNIQUE INDEX "module_unit_id_module_id_key"
ON "module_unit"("id", "module_id");

CREATE INDEX "daily_quests_module_unit_id_module_id_idx"
ON "daily_quests"("module_unit_id", "module_id");

ALTER TABLE "daily_quests"
ADD CONSTRAINT "daily_quests_module_unit_id_module_id_fkey"
FOREIGN KEY ("module_unit_id", "module_id") REFERENCES "module_unit"("id", "module_id")
ON DELETE NO ACTION ON UPDATE CASCADE;
