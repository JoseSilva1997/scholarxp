export class Module {
  id: number;
  title: string;
  description: string | null;
  createdByUserId: number | null;
  createdAt: Date;
  archivedAt: Date | null;
}
