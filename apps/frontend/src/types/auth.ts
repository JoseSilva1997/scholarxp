export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  globalRole: string;
};

export type AuthResponse = {
  user: AuthUser | null;
};
