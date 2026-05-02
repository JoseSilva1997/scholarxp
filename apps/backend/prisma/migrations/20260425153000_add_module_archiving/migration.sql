-- Add module archiving and make hard-delete cleanup cascade through authored lessons.
ALTER TABLE "modules" ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "module_unit" DROP CONSTRAINT "module_unit_module_id_fkey";

ALTER TABLE "module_unit"
ADD CONSTRAINT "module_unit_module_id_fkey"
FOREIGN KEY ("module_id") REFERENCES "modules"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
