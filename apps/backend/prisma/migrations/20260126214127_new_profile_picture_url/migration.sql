/*
  Warnings:

  - You are about to drop the column `sort_order` on the `question_unit` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "avatars_user_id_key";

-- DropIndex
DROP INDEX "lti_identity_institution_id_lti_user_id_key";

-- DropIndex
DROP INDEX "module_unit_question_groups_module_unit_id_name_key";

-- AlterTable
ALTER TABLE "question_unit" DROP COLUMN "sort_order";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile_picture_url" TEXT NOT NULL DEFAULT 'default-profile-pic.png';
