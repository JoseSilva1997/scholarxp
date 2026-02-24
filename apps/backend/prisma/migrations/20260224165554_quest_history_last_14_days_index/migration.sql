-- CreateIndex
CREATE INDEX "daily_quests_user_id_quest_date_utc_id_idx" ON "daily_quests"("user_id", "quest_date_utc" DESC, "id");
