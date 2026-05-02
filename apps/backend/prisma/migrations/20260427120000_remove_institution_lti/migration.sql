-- Remove institution and LTI schema objects after product ownership moved to direct module membership.
ALTER TABLE "modules" DROP CONSTRAINT "modules_institution_id_fkey";

DROP INDEX "modules_institution_id_lti_context_id_key";
DROP INDEX "modules_institution_id_resource_link_id_key";

ALTER TABLE "modules"
DROP COLUMN "institution_id",
DROP COLUMN "lti_context_id",
DROP COLUMN "resource_link_id";

DROP TABLE "lti_identity";
DROP TABLE "institutions";

BEGIN;
CREATE TYPE "AuthProvider_new" AS ENUM ('google', 'microsoft', 'local');
ALTER TABLE "auth_identity" ALTER COLUMN "provider" TYPE "AuthProvider_new" USING ("provider"::text::"AuthProvider_new");
ALTER TYPE "AuthProvider" RENAME TO "AuthProvider_old";
ALTER TYPE "AuthProvider_new" RENAME TO "AuthProvider";
DROP TYPE "AuthProvider_old";
COMMIT;

BEGIN;
CREATE TYPE "EnrollmentSource_new" AS ENUM ('invite', 'admin', 'csv');
ALTER TABLE "user_modules" ALTER COLUMN "enrolled_via" DROP DEFAULT;
ALTER TABLE "user_modules" ALTER COLUMN "enrolled_via" TYPE "EnrollmentSource_new" USING ("enrolled_via"::text::"EnrollmentSource_new");
ALTER TYPE "EnrollmentSource" RENAME TO "EnrollmentSource_old";
ALTER TYPE "EnrollmentSource_new" RENAME TO "EnrollmentSource";
DROP TYPE "EnrollmentSource_old";
ALTER TABLE "user_modules" ALTER COLUMN "enrolled_via" SET DEFAULT 'invite';
COMMIT;

BEGIN;
CREATE TYPE "GlobalRole_new" AS ENUM ('pending', 'admin', 'teacher', 'student');
ALTER TABLE "users" ALTER COLUMN "global_role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "global_role" TYPE "GlobalRole_new" USING ("global_role"::text::"GlobalRole_new");
ALTER TYPE "GlobalRole" RENAME TO "GlobalRole_old";
ALTER TYPE "GlobalRole_new" RENAME TO "GlobalRole";
DROP TYPE "GlobalRole_old";
ALTER TABLE "users" ALTER COLUMN "global_role" SET DEFAULT 'pending';
COMMIT;
