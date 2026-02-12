-- Role: harden attempt/progress persistence with deterministic uniqueness and hot-path indexes for practice submissions.

-- Ensure one module-unit progress row per (module_unit_id, student_id) so submit flow can upsert safely.
CREATE UNIQUE INDEX "module_unit_user_progress_module_unit_id_student_id_key"
ON "module_unit_user_progress"("module_unit_id", "student_id");

-- Speeds up first-correct checks per question unit during submit attempts.
CREATE INDEX "question_attempts_module_unit_id_student_id_question_id_is_correct_idx"
ON "question_attempts"("module_unit_id", "student_id", "question_id", "is_correct");

-- Speeds up latest-attempt reads for room hydration filtered by unit/student/question/content and recency ordering.
CREATE INDEX "question_attempts_module_unit_id_student_id_question_id_content_id_attempted_at_id_idx"
ON "question_attempts"("module_unit_id", "student_id", "question_id", "content_id", "attempted_at", "id");
