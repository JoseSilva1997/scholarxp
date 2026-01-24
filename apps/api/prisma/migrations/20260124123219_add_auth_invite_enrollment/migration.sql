-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('google', 'microsoft', 'local', 'lti');

-- CreateEnum
CREATE TYPE "InviteType" AS ENUM ('link', 'code');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('lti', 'invite', 'admin', 'csv');

-- DropForeignKey
ALTER TABLE "modules" DROP CONSTRAINT "modules_institution_id_fkey";

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "created_by_user_id" INTEGER,
ALTER COLUMN "institution_id" DROP NOT NULL,
ALTER COLUMN "lti_context_id" DROP NOT NULL,
ALTER COLUMN "resource_link_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_modules" ADD COLUMN     "enrolled_via" "EnrollmentSource" NOT NULL DEFAULT 'invite';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "auth_identity" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_password" (
    "user_id" INTEGER NOT NULL,
    "password_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_password_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "module_invites" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "created_by_user_id" INTEGER NOT NULL,
    "type" "InviteType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email_lock" TEXT,
    "max_uses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_identity_provider_provider_user_id_key" ON "auth_identity"("provider", "provider_user_id");

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identity" ADD CONSTRAINT "auth_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_password" ADD CONSTRAINT "user_password_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_invites" ADD CONSTRAINT "module_invites_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_invites" ADD CONSTRAINT "module_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
