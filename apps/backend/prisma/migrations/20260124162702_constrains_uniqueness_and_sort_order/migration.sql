/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `avatars` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[institution_id,lti_user_id]` on the table `lti_identity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[module_unit_id,name]` on the table `module_unit_question_groups` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "question_unit" ADD COLUMN     "sort_order" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "avatars_user_id_key" ON "avatars"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lti_identity_institution_id_lti_user_id_key" ON "lti_identity"("institution_id", "lti_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_unit_question_groups_module_unit_id_name_key" ON "module_unit_question_groups"("module_unit_id", "name");
