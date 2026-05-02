// Stores the bcrypt hash for a user's local (non-OAuth) password. Keyed by userId with no
// surrogate PK, enforcing the one-to-one relationship at the schema level.
export class UserPassword {
  // Doubles as the primary key; there is no separate auto-increment id for this table.
  userId: number;
  // bcrypt-hashed password. The plaintext value is never persisted.
  passwordHash: string;
  updatedAt: Date;
}
