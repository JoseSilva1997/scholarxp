/*
  Warnings:

  - The values [instructor] on the enum `GlobalRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GlobalRole_new" AS ENUM ('pending', 'admin', 'institution_admin', 'teacher', 'student');
ALTER TABLE "public"."users" ALTER COLUMN "global_role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "global_role" TYPE "GlobalRole_new" USING ("global_role"::text::"GlobalRole_new");
ALTER TYPE "GlobalRole" RENAME TO "GlobalRole_old";
ALTER TYPE "GlobalRole_new" RENAME TO "GlobalRole";
DROP TYPE "public"."GlobalRole_old";
ALTER TABLE "users" ALTER COLUMN "global_role" SET DEFAULT 'pending';
COMMIT;
