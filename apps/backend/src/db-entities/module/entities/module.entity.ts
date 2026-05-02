// Top-level learning module that groups units, students, and quests. Soft-deleted via archivedAt
// and permanently purged by the scheduled cleanup job after a 30-day grace period with no learner data.
export class Module {
  id: number;
  title: string;
  description: string | null;
  // Null when the creating teacher account has been deleted and ownership was reassigned to the Anon sentinel.
  createdByUserId: number | null;
  createdAt: Date;
  // Null while active. Set when an instructor archives the module; triggers the purge-eligibility clock.
  archivedAt: Date | null;
}
