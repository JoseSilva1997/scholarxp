export class Module {
  id: number;
  institutionId: number | null;
  ltiContextId: string | null;
  resourceLinkId: string | null;
  title: string;
  description: string | null;
  createdByUserId: number | null;
  createdAt: Date;
}
