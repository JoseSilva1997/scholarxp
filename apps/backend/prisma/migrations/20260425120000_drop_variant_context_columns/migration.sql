-- Drop obsolete AI variant-generation context settings from modules and lessons.
ALTER TABLE "modules" DROP COLUMN "variant_context";
ALTER TABLE "module_unit" DROP COLUMN "variant_context";
