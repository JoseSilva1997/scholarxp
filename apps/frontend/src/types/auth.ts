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
};

export type AuthResponse = {
  user: AuthUser | null;
};
