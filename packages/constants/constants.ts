// This page stores constants used across the backend application.
export const FRONTEND_URL = 'http://localhost:5173';
export const BACKEND_URL = 'http://localhost:3000';

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
    PROGRESSION SYSTEM (GAMIFICATION) RULES
*/
export const STUDENT_EXP_MAX = 1000;
export const MODULE_EXP_MAX = 1000;