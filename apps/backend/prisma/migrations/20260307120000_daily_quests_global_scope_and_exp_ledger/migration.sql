-- Enables global-scoped daily quests and adds an XP ledger for idempotent reward event tracking.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "daily_quests"
ALTER COLUMN "module_id" DROP NOT NULL;

-- Replace nullable-unsafe unique index with two partial unique indexes:
-- module-scoped quests and global-scoped quests cannot duplicate per user/day/type.
DROP INDEX IF EXISTS "daily_quests_user_id_module_id_type_quest_date_utc_key";

CREATE UNIQUE INDEX "daily_quests_user_module_type_day_unique_idx"
ON "daily_quests" ("user_id", "module_id", "type", "quest_date_utc")
WHERE "module_id" IS NOT NULL;

CREATE UNIQUE INDEX "daily_quests_user_global_type_day_unique_idx"
ON "daily_quests" ("user_id", "type", "quest_date_utc")
WHERE "module_id" IS NULL;

-- If a quest targets a unit, it must also carry a module id for composite FK integrity.
ALTER TABLE "daily_quests"
ADD CONSTRAINT "daily_quests_module_scope_consistency_check"
CHECK ("module_unit_id" IS NULL OR "module_id" IS NOT NULL);

CREATE TABLE "exp_ledger" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" INTEGER NOT NULL,
  "module_id" INTEGER,
  "module_unit_id" INTEGER,
  "session_id" UUID,
  "quest_id" INTEGER,
  "idempotency_key" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "awarded_exp" INTEGER NOT NULL,
  "event_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exp_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exp_ledger_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exp_ledger_module_id_fkey"
    FOREIGN KEY ("module_id") REFERENCES "modules"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "exp_ledger_module_unit_id_fkey"
    FOREIGN KEY ("module_unit_id") REFERENCES "module_unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "exp_ledger_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "exp_ledger_quest_id_fkey"
    FOREIGN KEY ("quest_id") REFERENCES "daily_quests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "exp_ledger_idempotency_key_key"
ON "exp_ledger" ("idempotency_key");

CREATE INDEX "exp_ledger_user_id_event_timestamp_id_idx"
ON "exp_ledger" ("user_id", "event_timestamp" DESC, "id");

CREATE INDEX "exp_ledger_scope_event_type_idx"
ON "exp_ledger" ("session_id", "quest_id", "event_type");
