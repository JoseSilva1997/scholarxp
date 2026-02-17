import type { Quest } from '@scholarxp/api-contracts'

export type QuestFrontend = {
    quest: Quest; // The original quest data from the API
    description: string; // A human-readable description of the quest
    badgeSrc: string; // URL to the quest badge image based on type and completion status
}