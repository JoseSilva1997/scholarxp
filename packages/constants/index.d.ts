// Package-level declarations for @scholarxp/constants
// Provides minimal, stable type declarations so TypeScript consumers
// (and d.ts builders) can resolve types from this workspace package.

// Top-level URLs
export declare const FRONTEND_URL: string;
export declare const BACKEND_URL: string;

// Practice mode constants (literal types help consumers derive unions)
export declare const PRACTICE_MODES: {
  PRACTICE_ROOM: 'PRACTICE_ROOM';
};

// Validation rule constants
export declare const NAME_MIN_LENGTH: number;
export declare const NAME_MAX_LENGTH: number;
export declare const NAME_REGEX: RegExp;
export declare const NAME_REGEX_MESSAGE: string;
export declare const PASSWORD_MIN_LENGTH: number;
export declare const PASSWORD_COMPLEXITY_REGEX: RegExp;
export declare const PASSWORD_COMPLEXITY_MESSAGE: string;

// Invite defaults
export declare const MODULE_INVITE_DEFAULT_EXPIRY_HOURS: number;
export declare const MODULE_INVITE_DEFAULT_MAX_USES: number;

// Progression caps
export declare const STUDENT_EXP_MAX: number;
export declare const MODULE_EXP_MAX: number;
