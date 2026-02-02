// This page stores constants used across the backend application.
export const FRONTEND_URL = 'http://localhost:5173';
export const BACKEND_URL = 'http://localhost:3000';

// Default window (in hours) for module invite expiration so instructors can share links without manual tuning.
export const MODULE_INVITE_DEFAULT_EXPIRY_HOURS = 48;

// Default invite usage ceiling to mitigate spam while keeping day‑to‑day class sizes covered.
export const MODULE_INVITE_DEFAULT_MAX_USES = 100;

/*
    VALIDATION RULES
*/

// Describes reusable name validation constraints to keep first/last name rules consistent.
export const NAME_MAX_LENGTH = 40;
// Allow letters, some punctuation for names (hyphen, apostrophe, spaces) while blocking numbers/symbol noise.
export const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]+$/;
export const NAME_REGEX_MESSAGE =
  'Name can only include letters, spaces, apostrophes, or hyphens';

// Provides shared password strength requirements so auth flows stay consistent across DTOs and services.
export const PASSWORD_MIN_LENGTH = 10;
// Require at least one lowercase, one uppercase, one digit, and one symbol from a limited set to stay user friendly.
export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/;
export const PASSWORD_COMPLEXITY_MESSAGE =
  'Password must include uppercase, lowercase, number, and symbol characters.';

