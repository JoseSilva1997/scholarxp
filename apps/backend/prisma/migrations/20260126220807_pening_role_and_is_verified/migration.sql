-- Step 1: add the new enum value
ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS 'pending';

-- Step 2: add isVerified; leave default change for a subsequent migration to avoid
-- "unsafe use of new value" errors in the same transaction.
ALTER TABLE "users" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
