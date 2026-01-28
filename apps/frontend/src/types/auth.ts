// Defines the authenticated user shape returned by the backend session APIs.
export type GlobalRole = 'pending' | 'admin' | 'institution_admin' | 'instructor' | 'student';

export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  profilePictureUrl: string;
  globalRole: GlobalRole;
  isVerified: boolean;
  requiresEmailVerification?: boolean;
  avatar?: {
    id: number;
    level: number;
    currentExp: number;
  } | null;
};

export type AuthResponse = {
  user: AuthUser | null;
};
