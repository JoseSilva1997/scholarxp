/*
  Warnings:

  - A unique constraint covering the columns `[user_id,module_id,type,quest_date_utc]` on the table `daily_quests` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `quest_date_utc` to the `daily_quests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "daily_quests" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "quest_date_utc" DATE NOT NULL;

-- AlterTable
ALTER TABLE "practice_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "daily_quests_user_id_module_id_type_quest_date_utc_key" ON "daily_quests"("user_id", "module_id", "type", "quest_date_utc");

-- RenameIndex
ALTER INDEX "question_attempts_module_unit_id_student_id_question_id_content" RENAME TO "question_attempts_module_unit_id_student_id_question_id_con_idx";

-- RenameIndex
ALTER INDEX "question_attempts_module_unit_id_student_id_question_id_is_corr" RENAME TO "question_attempts_module_unit_id_student_id_question_id_is__idx";
