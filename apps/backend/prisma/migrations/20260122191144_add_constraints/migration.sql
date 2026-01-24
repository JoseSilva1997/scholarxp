/*
  Warnings:

  - You are about to drop the column `core_question_id` on the `question_unit` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[content_id]` on the table `question_variant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `question_unit_id` to the `question_content` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "avatars" DROP CONSTRAINT "avatars_user_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_quests" DROP CONSTRAINT "daily_quests_module_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_quests" DROP CONSTRAINT "daily_quests_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lti_identity" DROP CONSTRAINT "lti_identity_institution_id_fkey";

-- DropForeignKey
ALTER TABLE "lti_identity" DROP CONSTRAINT "lti_identity_user_id_fkey";

-- DropForeignKey
ALTER TABLE "module_unit" DROP CONSTRAINT "module_unit_module_id_fkey";

-- DropForeignKey
ALTER TABLE "module_unit_question_groups" DROP CONSTRAINT "module_unit_question_groups_module_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "module_unit_user_progress" DROP CONSTRAINT "module_unit_user_progress_module_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "module_unit_user_progress" DROP CONSTRAINT "module_unit_user_progress_student_id_fkey";

-- DropForeignKey
ALTER TABLE "modules" DROP CONSTRAINT "modules_institution_id_fkey";

-- DropForeignKey
ALTER TABLE "practice_sessions" DROP CONSTRAINT "practice_sessions_module_id_fkey";

-- DropForeignKey
ALTER TABLE "practice_sessions" DROP CONSTRAINT "practice_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "question_attempts" DROP CONSTRAINT "question_attempts_content_id_fkey";

-- DropForeignKey
ALTER TABLE "question_attempts" DROP CONSTRAINT "question_attempts_module_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "question_attempts" DROP CONSTRAINT "question_attempts_question_id_fkey";

-- DropForeignKey
ALTER TABLE "question_attempts" DROP CONSTRAINT "question_attempts_student_id_fkey";

-- DropForeignKey
ALTER TABLE "question_unit" DROP CONSTRAINT "question_unit_core_question_id_fkey";

-- DropForeignKey
ALTER TABLE "question_unit" DROP CONSTRAINT "question_unit_module_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "question_unit" DROP CONSTRAINT "question_unit_question_group_id_fkey";

-- DropForeignKey
ALTER TABLE "question_variant" DROP CONSTRAINT "question_variant_content_id_fkey";

-- DropForeignKey
ALTER TABLE "question_variant" DROP CONSTRAINT "question_variant_question_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "user_modules" DROP CONSTRAINT "user_modules_module_id_fkey";

-- DropForeignKey
ALTER TABLE "user_modules" DROP CONSTRAINT "user_modules_user_id_fkey";

-- AlterTable
ALTER TABLE "module_unit" ALTER COLUMN "module_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "module_unit_user_progress" ALTER COLUMN "student_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "practice_sessions" ALTER COLUMN "module_id" DROP NOT NULL,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "question_attempts" ALTER COLUMN "module_unit_id" DROP NOT NULL,
ALTER COLUMN "student_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "question_content" ADD COLUMN     "is_core" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "question_unit_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "question_unit" DROP COLUMN "core_question_id",
ALTER COLUMN "module_unit_id" DROP NOT NULL,
ALTER COLUMN "question_group_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "question_variant_content_id_key" ON "question_variant"("content_id");

-- AddForeignKey
ALTER TABLE "lti_identity" ADD CONSTRAINT "lti_identity_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_identity" ADD CONSTRAINT "lti_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quests" ADD CONSTRAINT "daily_quests_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quests" ADD CONSTRAINT "daily_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit" ADD CONSTRAINT "module_unit_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit_question_groups" ADD CONSTRAINT "module_unit_question_groups_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit_user_progress" ADD CONSTRAINT "module_unit_user_progress_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit_user_progress" ADD CONSTRAINT "module_unit_user_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_unit" ADD CONSTRAINT "question_unit_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_unit" ADD CONSTRAINT "question_unit_question_group_id_fkey" FOREIGN KEY ("question_group_id") REFERENCES "module_unit_question_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_content" ADD CONSTRAINT "question_content_question_unit_id_fkey" FOREIGN KEY ("question_unit_id") REFERENCES "question_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_variant" ADD CONSTRAINT "question_variant_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "question_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_variant" ADD CONSTRAINT "question_variant_question_unit_id_fkey" FOREIGN KEY ("question_unit_id") REFERENCES "question_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "question_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
