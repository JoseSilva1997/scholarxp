// This page stores constants used across the backend application.
export const FRONTEND_URL = 'http://localhost:5173';
export const BACKEND_URL = 'http://localhost:3000';

export const PRACTICE_MODES = {
  PRACTICE_ROOM: 'PRACTICE_ROOM',
} as const;

// Shared literal union for practice mode values across API contracts and backend DTOs.
export type PracticeMode =
  (typeof PRACTICE_MODES)[keyof typeof PRACTICE_MODES];


/*
    VALIDATION RULES
*/

// Describes reusable name validation constraints to keep first/last name rules consistent.
// Use blocklist approach to support international names (Arabic, Chinese, Cyrillic, Hindi, etc.)
// while blocking only known-problematic characters (URLs, script injection, control chars).
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 100;
// Rejects only dangerous patterns: URLs, HTML/script tags, symbols commonly used in injection attacks.
// Allows Unicode letters, numbers, and safe punctuation (space, hyphen, apostrophe, period, comma).
export const NAME_REGEX = /^[^<>/@#$%^&()\[\]{};:"'|`~\\]*[^<>/@#$%^&()\[\]{};:"'|`~\\\s]([^<>/@#$%^&()\[\]{};:"'|`~\\]*[^<>/@#$%^&()\[\]{};:"'|`~\\\s])?$/;
export const NAME_REGEX_MESSAGE =
  'Name cannot contain < > / @ # $ % ^ & * ( ) [ ] { } ; : " \' | ` ~ or \\ characters';

// Provides shared password strength requirements so auth flows stay consistent across DTOs and services.
export const PASSWORD_MIN_LENGTH = 10;
// Require at least one lowercase, one uppercase, one digit, and one symbol from a limited set to stay user friendly.
export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/;
export const PASSWORD_COMPLEXITY_MESSAGE =
  'Password must include uppercase, lowercase, number, and symbol characters.';


// Default window (in hours) for module invite expiration so instructors can share links without manual tuning.
export const MODULE_INVITE_DEFAULT_EXPIRY_HOURS = 48;
// Default invite usage ceiling to mitigate spam while keeping day‑to‑day class sizes covered.
export const MODULE_INVITE_DEFAULT_MAX_USES = 100;

/*
    PROGRESSION SYSTEM EXP (GAMIFICATION) RULES
*/
export const STUDENT_EXP_MAX = 1000;
export const MODULE_UNIT_BASELINE_EXP = 1000;
// XP awarded when reachin a new streak tier (e.g. streak length 30% = 50XP, 50% = 100XP, 100% = 150XP).
export const STREAK_BONUS_EXP_PER_DELTA = 50;
 // Potential maximum bonus for first-attempt correctness across all questions in a module unit.
export const MAXIMUM_FIRST_ATTEMPT_BONUS_EXP = 150;

// Module Unit completion rewards with deminishing returs per completion per UTC day
export const MODULE_UNIT_COMPLETION_REWARDS = {
  FIRST_COMPLETION: 100,
  SECOND_COMPLETION: 25,
  SUBSEQUENT_COMPLETIONS: 0,
}

export type MODULE_UNIT_COMPLETION_REWARD = typeof MODULE_UNIT_COMPLETION_REWARDS[keyof typeof MODULE_UNIT_COMPLETION_REWARDS];

// Centralised definitions of event types.
export const ExpLedgerEventTypes = {
    COMPLETE_MODULE_UNIT: 'module_unit_completed',
    COMPLETE_QUEST: 'quest_completed',
    CORRECT_PRACTICE_ROOM_ANSWER: 'practice_room_answer_correct',
    PRACTICE_ROOM_STREAK: 'practice_room_streak',
    PRACTICE_ROOM_CORRECT_AT_FIRST_ATTEMPT: 'practice_room_correct_at_first_attempt',
    // Add more event types as needed
} as const

export type ExpLedgerEventType = typeof ExpLedgerEventTypes[keyof typeof ExpLedgerEventTypes];