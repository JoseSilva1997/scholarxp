// Describes reusable name validation constraints to keep first/last name rules consistent.
export const NAME_MAX_LENGTH = 40;
// Allow letters, some punctuation for names (hyphen, apostrophe, spaces) while blocking numbers/symbol noise.
export const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]+$/;
export const NAME_REGEX_MESSAGE =
  'Name can only include letters, spaces, apostrophes, or hyphens';
