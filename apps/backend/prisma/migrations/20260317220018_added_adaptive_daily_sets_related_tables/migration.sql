-- CreateTable
CREATE TABLE "student_question_state" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "module_unit_id" INTEGER NOT NULL,
    "question_unit_id" INTEGER NOT NULL,
    "fsrs_state" TEXT NOT NULL,
    "fsrs_difficulty" DOUBLE PRECISION NOT NULL,
    "fsrs_stability" DOUBLE PRECISION NOT NULL,
    "fsrs_due_at" TIMESTAMP(3) NOT NULL,
    "fsrs_last_reviewed_at" TIMESTAMP(3),
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "lapse_count" INTEGER NOT NULL DEFAULT 0,
    "last_grade" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "last_correct_at" TIMESTAMP(3),
    "recent_avg_time_ms" INTEGER,
    "first_seen_at" TIMESTAMP(3),
    "algorithm_version" TEXT NOT NULL DEFAULT 'fsrs_v1',

    CONSTRAINT "student_question_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_practice_sets" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,
    "practice_date_utc" DATE NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "algorithm_version" TEXT NOT NULL DEFAULT 'fsrs_v1',

    CONSTRAINT "daily_practice_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_practice_set_items" (
    "id" UUID NOT NULL,
    "daily_practice_set_id" UUID NOT NULL,
    "question_unit_id" INTEGER NOT NULL,
    "module_unit_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "selection_reason" TEXT NOT NULL,
    "selection_score" DOUBLE PRECISION NOT NULL,
    "source_bucket" TEXT NOT NULL,

    CONSTRAINT "daily_practice_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_question_state_due_lookup_idx" ON "student_question_state"("user_id", "module_id", "fsrs_due_at", "question_unit_id");

-- CreateIndex
CREATE INDEX "student_question_state_module_unit_lookup_idx" ON "student_question_state"("user_id", "module_id", "module_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_question_state_user_id_question_unit_id_key" ON "student_question_state"("user_id", "question_unit_id");

-- CreateIndex
CREATE INDEX "daily_practice_set_user_module_day_idx" ON "daily_practice_sets"("user_id", "module_id", "practice_date_utc" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_practice_set_user_module_day_key" ON "daily_practice_sets"("user_id", "module_id", "practice_date_utc");

-- CreateIndex
CREATE INDEX "daily_practice_set_item_bucket_lookup_idx" ON "daily_practice_set_items"("module_unit_id", "source_bucket");

-- CreateIndex
CREATE UNIQUE INDEX "daily_practice_set_item_question_key" ON "daily_practice_set_items"("daily_practice_set_id", "question_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_practice_set_item_position_key" ON "daily_practice_set_items"("daily_practice_set_id", "position");

-- AddForeignKey
ALTER TABLE "student_question_state" ADD CONSTRAINT "student_question_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_question_state" ADD CONSTRAINT "student_question_state_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_question_state" ADD CONSTRAINT "student_question_state_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_question_state" ADD CONSTRAINT "student_question_state_question_unit_id_fkey" FOREIGN KEY ("question_unit_id") REFERENCES "question_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_practice_sets" ADD CONSTRAINT "daily_practice_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_practice_sets" ADD CONSTRAINT "daily_practice_sets_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_practice_set_items" ADD CONSTRAINT "daily_practice_set_items_daily_practice_set_id_fkey" FOREIGN KEY ("daily_practice_set_id") REFERENCES "daily_practice_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_practice_set_items" ADD CONSTRAINT "daily_practice_set_items_question_unit_id_fkey" FOREIGN KEY ("question_unit_id") REFERENCES "question_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_practice_set_items" ADD CONSTRAINT "daily_practice_set_items_module_unit_id_fkey" FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
