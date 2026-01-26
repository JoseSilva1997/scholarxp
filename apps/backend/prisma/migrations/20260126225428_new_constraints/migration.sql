/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `avatars` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[module_unit_id,name]` on the table `module_unit_question_groups` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "avatars_user_id_key" ON "avatars"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_unit_question_groups_module_unit_id_name_key" ON "module_unit_question_groups"("module_unit_id", "name");
