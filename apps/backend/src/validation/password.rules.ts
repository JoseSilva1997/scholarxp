// Provides shared password strength requirements so auth flows stay consistent across DTOs and services.
export const PASSWORD_MIN_LENGTH = 10;
// Require at least one lowercase, one uppercase, one digit, and one symbol from a limited set to stay user friendly.
export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/;
export const PASSWORD_COMPLEXITY_MESSAGE =
  'Password must include uppercase, lowercase, number, and symbol characters.';
