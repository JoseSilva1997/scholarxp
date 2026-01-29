// Shared type for modules as returned by backend module endpoints.
export type ModuleSummary = {
  id: number;
  institutionId?: number | null;
  ltiContextId?: string | null;
  resourceLinkId?: string | null;
  variantContext?: string | null;
  title: string;
  description?: string | null;
  createdByUserId?: number | null;
};
