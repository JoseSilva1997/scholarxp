-- DropIndex
DROP INDEX "daily_quests_user_global_type_day_unique_idx";

-- DropIndex
DROP INDEX "daily_quests_user_module_type_day_unique_idx";

-- DropIndex
DROP INDEX "module_unit_question_groups_active_name_unique";

-- AlterTable
ALTER TABLE "avatars" ADD COLUMN     "total_exp" INTEGER NOT NULL DEFAULT 0;
