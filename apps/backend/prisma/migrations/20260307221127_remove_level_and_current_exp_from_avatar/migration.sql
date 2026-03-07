/*
  Warnings:

  - You are about to drop the column `current_exp` on the `avatars` table. All the data in the column will be lost.
  - You are about to drop the column `level` on the `avatars` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "avatars" DROP COLUMN "current_exp",
DROP COLUMN "level";
