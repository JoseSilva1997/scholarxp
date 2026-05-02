// Tracks a student's global XP accumulation. Only students have avatars; creation is gated by role check.
export class Avatar {
  id: number;
  userId: number;
  // Authoritative cumulative XP. Updated exclusively through AvatarService.addStudentExp to prevent drift.
  totalExp: number;
  createdAt: Date;
}
