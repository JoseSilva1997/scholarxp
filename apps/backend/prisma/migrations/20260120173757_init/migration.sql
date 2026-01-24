-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('admin', 'institution_admin', 'instructor', 'student');

-- CreateEnum
CREATE TYPE "ModuleUnitStatus" AS ENUM ('draft', 'locked', 'live', 'archived');

-- CreateTable
CREATE TABLE "institutions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lms_platform" TEXT NOT NULL,
    "lms_issuer_url" TEXT NOT NULL,
    "lms_client_id" TEXT NOT NULL,
    "lms_deployment_id" TEXT NOT NULL,
    "jwks_url" TEXT NOT NULL,
    "auth_token_url" TEXT NOT NULL,
    "auth_request_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_identity" (
    "id" SERIAL NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lti_user_id" TEXT NOT NULL,

    CONSTRAINT "lti_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "global_role" "GlobalRole" NOT NULL DEFAULT 'student',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatars" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "current_exp" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" SERIAL NOT NULL,
    "institution_id" INTEGER NOT NULL,
    "lti_context_id" TEXT NOT NULL,
    "resource_link_id" TEXT NOT NULL,
    "variant_context" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_modules" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_in_module" TEXT NOT NULL,
    "user_module_level" INTEGER NOT NULL,
    "current_exp" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quests" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "exp_granted" INTEGER NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_unit" (
    "id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "variant_context" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question_count" INTEGER NOT NULL,
    "status" "ModuleUnitStatus" NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_unit_question_groups" (
    "id" SERIAL NOT NULL,
    "module_unit_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "module_unit_question_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_unit_user_progress" (
    "id" SERIAL NOT NULL,
    "module_unit_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "current_mastery_score" DOUBLE PRECISION NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "no_of_correct_answers" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "last_practiced_at" TIMESTAMP(3),

    CONSTRAINT "module_unit_user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_unit" (
    "id" SERIAL NOT NULL,
    "core_question_id" INTEGER NOT NULL,
    "module_unit_id" INTEGER NOT NULL,
    "question_group_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_content" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "question_stem" TEXT NOT NULL,
    "question_data" JSONB NOT NULL,
    "hint" TEXT,
    "difficulty_score" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_variant" (
    "id" SERIAL NOT NULL,
    "question_unit_id" INTEGER NOT NULL,
    "content_id" INTEGER NOT NULL,
    "variant_label" TEXT NOT NULL,

    CONSTRAINT "question_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_attempts" (
    "id" SERIAL NOT NULL,
    "module_unit_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "content_id" INTEGER NOT NULL,
    "practice_mode" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "time_taken_ms" INTEGER NOT NULL,
    "hints_used" INTEGER NOT NULL DEFAULT 0,
    "student_answer" JSONB NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutions_lms_issuer_url_lms_client_id_lms_deployment_id_key" ON "institutions"("lms_issuer_url", "lms_client_id", "lms_deployment_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "modules_institution_id_lti_context_id_key" ON "modules"("institution_id", "lti_context_id");

-- CreateIndex
CREATE UNIQUE INDEX "modules_institution_id_resource_link_id_key" ON "modules"("institution_id", "resource_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_modules_module_id_user_id_key" ON "user_modules"("module_id", "user_id");

-- AddForeignKey
ALTER TABLE "lti_identity" ADD CONSTRAINT "lti_identity_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_identity" ADD CONSTRAINT "lti_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quests" ADD CONSTRAINT "daily_quests_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quests" ADD CONSTRAINT "daily_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit" ADD CONSTRAINT "module_unit_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit_question_groups" ADD CONSTRAINT "module_unit_question_groups_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit_user_progress" ADD CONSTRAINT "module_unit_user_progress_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_unit_user_progress" ADD CONSTRAINT "module_unit_user_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_unit" ADD CONSTRAINT "question_unit_core_question_id_fkey" FOREIGN KEY ("core_question_id") REFERENCES "question_content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_unit" ADD CONSTRAINT "question_unit_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_unit" ADD CONSTRAINT "question_unit_question_group_id_fkey" FOREIGN KEY ("question_group_id") REFERENCES "module_unit_question_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_variant" ADD CONSTRAINT "question_variant_question_unit_id_fkey" FOREIGN KEY ("question_unit_id") REFERENCES "question_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_variant" ADD CONSTRAINT "question_variant_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "question_content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "question_content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
