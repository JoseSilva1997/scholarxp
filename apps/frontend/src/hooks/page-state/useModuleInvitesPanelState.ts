// Encapsulates invite list/actions state so the settings panel can focus on rendering structure.
// The hook manages fetches, UI state, and action side effects without concerning the
// caller about implementation details.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import { logError } from '../../utils/logger';
import {
  useCreateModuleInviteMutation,
  useDeleteModuleInviteMutation,
  useModuleInvitesQuery,
  useUpdateModuleInviteMutation,
} from '../queries/useModuleInvitesQueries';
import type { ModuleInvite, ModuleSummary } from '../../types/module';

// parameters passed in from the panel component; they drive whether we
// start loading invites and which module context we operate in.
type UseModuleInvitesPanelStateParams = {
  module: ModuleSummary | null;
  isOpen: boolean;
  canShowInvites: boolean;
};

// public API returned by the hook. The panel consumes these values and
// callbacks to render and interact with invites; none of this needs to know
// how the underlying fetch/mutation hooks work.
type UseModuleInvitesPanelStateResult = {
  invites: ModuleInvite[];
  inviteError: string | null;
  isInvitesLoading: boolean;
  isCreatingInvite: boolean;
  createExpiry: number;
  setCreateExpiry: (value: number) => void;
  createMaxUses: number;
  setCreateMaxUses: (value: number) => void;
  refreshInvites: () => void;
  handleCreateInvite: (event: React.FormEvent) => Promise<void>;
  handleRevokeInvite: (invite: ModuleInvite) => Promise<void>;
  handleDeleteInvite: (invite: ModuleInvite) => Promise<void>;
  formatExpiry: (invite: ModuleInvite) => string;
  canCopyInviteLink: (invite: ModuleInvite) => boolean;
  isInviteCopied: (invite: ModuleInvite) => boolean;
  copyInviteLink: (invite: ModuleInvite) => void;
};

export function useModuleInvitesPanelState({
  module,
  isOpen,
  canShowInvites,
}: UseModuleInvitesPanelStateParams): UseModuleInvitesPanelStateResult {
  // extract primitive moduleId early so hooks can depend on it simply
  const moduleId = module?.id ?? null;

  // API hooks are tied to moduleId; they stay inactive until panel is visible.
  const invitesQuery = useModuleInvitesQuery(moduleId, isOpen && canShowInvites);
  const createInviteMutation = useCreateModuleInviteMutation(moduleId);
  const updateInviteMutation = useUpdateModuleInviteMutation(moduleId);
  const deleteInviteMutation = useDeleteModuleInviteMutation(moduleId);

  // client-only map of invite IDs to generated URLs. list endpoint never
  // returns tokens after creation so we stash them ourselves for copying.
  const [inviteLinks, setInviteLinks] = useState<Record<number, string>>({});

  // track the latest action failure scoped to the current module; this lets us
  // display a single string even if different operations fail.
  const [inviteActionError, setInviteActionError] = useState<{
    moduleId: number | null;
    message: string | null;
  }>({
    moduleId: null,
    message: null,
  });

  // form state for the create-invite form. reset to defaults on success.
  const [createExpiry, setCreateExpiry] = useState(48);
  const [createMaxUses, setCreateMaxUses] = useState(100);

  // copy-to-clipboard feedback timeout. clears after two seconds.
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);

  // log network errors from the list query; we don't surface them directly
  // here because the UI already shows a friendly message via inviteError.
  useEffect(() => {
    if (!invitesQuery.error || moduleId === null) return;
    logError(invitesQuery.error, { feature: 'module-invites', action: 'list', moduleId });
  }, [invitesQuery.error, moduleId]);

  // derived values the component will read directly; memoize where
  // helpful to avoid unnecessary re-renders.
  const invites = useMemo(() => invitesQuery.data ?? [], [invitesQuery.data]);
  const isInvitesLoading = invitesQuery.isPending || invitesQuery.isRefetching;
  const isCreatingInvite = createInviteMutation.isPending;

  // turn errors from the various sources into a single friendly string.
  const inviteErrorFromQuery = invitesQuery.error
    ? invitesQuery.error instanceof ApiError
      ? invitesQuery.error.message
      : 'Could not load invites right now. Please try again.'
    : null;
  const inviteErrorFromActions =
    inviteActionError.moduleId === moduleId ? inviteActionError.message : null;
  const inviteError = inviteErrorFromActions ?? inviteErrorFromQuery;


  // human-readable status string for an invite's expiry. this is a helper so
  // the component doesn't reimplement the logic every render.
  const formatExpiry = useCallback(
    (invite: ModuleInvite) => {
      const expiryDate = invite.expiresAt ? new Date(invite.expiresAt) : null;
      // Use query refresh time as a stable "now" reference to keep expiry checks render-pure.
      const now = invitesQuery.dataUpdatedAt;
      const hasUseCap = invite.maxUses != null;
      const isUsageExhausted = hasUseCap && invite.uses >= (invite.maxUses ?? 0);
      const isTimeExpired = expiryDate ? expiryDate.getTime() <= now : false;

      if (invite.revokedAt) return 'Revoked';
      if (isUsageExhausted) return 'Expired (max uses reached)';
      if (isTimeExpired) return 'Expired';
      if (!expiryDate) return 'No expiry';

      return `Expires ${expiryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    },
    [invitesQuery.dataUpdatedAt],
  );

  // expose a refresh method so parent can force reload after successful
  // external actions (e.g. another component updated the module).
  const refreshInvites = useCallback(() => {
    void invitesQuery.refetch();
  }, [invitesQuery]);

  // create button handler; keeps the form values in hook state so the caller
  // can render simple controlled inputs. errors get captured and logged.
  const handleCreateInvite = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!module || isCreatingInvite) return;
      setInviteActionError({ moduleId: module.id, message: null });
      try {
        const result = await createInviteMutation.mutateAsync({
          expiresInHours: createExpiry,
          maxUses: createMaxUses,
        });
        // Store created-link URLs client-side because list endpoints intentionally never re-return raw tokens.
        setInviteLinks((prev) => ({ ...prev, [result.invite.id]: result.url }));
        setCreateExpiry(48);
        setCreateMaxUses(100);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Could not create invite. Please try again.';
        setInviteActionError({ moduleId: module.id, message });
        logError(err, { feature: 'module-invites', action: 'create', moduleId: module.id });
      }
    },
    [createExpiry, createInviteMutation, createMaxUses, isCreatingInvite, module],
  );

  // revoke action sent when the user hits the revoke button. only clears
  // errors if the mutation succeeds or module changes.
  const handleRevokeInvite = useCallback(
    async (invite: ModuleInvite) => {
      if (!module) return;
      setInviteActionError({ moduleId: module.id, message: null });
      try {
        await updateInviteMutation.mutateAsync({ inviteId: invite.id, payload: { revoke: true } });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Could not revoke invite. Please try again.';
        setInviteActionError({ moduleId: module.id, message });
        logError(err, { feature: 'module-invites', action: 'revoke', moduleId: module.id });
      }
    },
    [module, updateInviteMutation],
  );

  // delete handler also purges our cached link since it's no longer valid.
  const handleDeleteInvite = useCallback(
    async (invite: ModuleInvite) => {
      if (!module) return;
      setInviteActionError({ moduleId: module.id, message: null });
      try {
        await deleteInviteMutation.mutateAsync(invite.id);
        setInviteLinks((prev) => {
          const copy = { ...prev };
          delete copy[invite.id];
          return copy;
        });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Could not delete invite. Please try again.';
        setInviteActionError({ moduleId: module.id, message });
        logError(err, { feature: 'module-invites', action: 'delete', moduleId: module.id });
      }
    },
    [deleteInviteMutation, module],
  );

  // allow copying only when we have the URL and the invite isn't stale.
  const canCopyInviteLink = useCallback(
    (invite: ModuleInvite) => {
      const expiryStatus = formatExpiry(invite);
      const isExpired = expiryStatus.startsWith('Expired') || Boolean(invite.revokedAt);
      return Boolean(inviteLinks[invite.id]) && !isExpired;
    },
    [formatExpiry, inviteLinks],
  );

  // simple equality check to drive UI feedback when the link has been
  // recently copied.
  const isInviteCopied = useCallback(
    (invite: ModuleInvite) => copiedInviteId === invite.id,
    [copiedInviteId],
  );

  // copy URL into clipboard; on success we trigger a brief feedback state.
  const copyInviteLink = useCallback(
    (invite: ModuleInvite) => {
      const link = inviteLinks[invite.id];
      if (!link) return;
      navigator.clipboard
        .writeText(link)
        .then(() => {
          setCopiedInviteId(invite.id);
          setTimeout(() => setCopiedInviteId(null), 2000);
        })
        .catch((err) =>
          logError(err, { feature: 'module-invites', action: 'copy', inviteId: invite.id }),
        );
    },
    [inviteLinks],
  );

  return useMemo(
    () => ({
      invites,
      inviteError,
      isInvitesLoading,
      isCreatingInvite,
      createExpiry,
      setCreateExpiry,
      createMaxUses,
      setCreateMaxUses,
      refreshInvites,
      handleCreateInvite,
      handleRevokeInvite,
      handleDeleteInvite,
      formatExpiry,
      canCopyInviteLink,
      isInviteCopied,
      copyInviteLink,
    }),
    [
      canCopyInviteLink,
      copyInviteLink,
      createExpiry,
      createMaxUses,
      formatExpiry,
      handleCreateInvite,
      handleDeleteInvite,
      handleRevokeInvite,
      inviteError,
      invites,
      isCreatingInvite,
      isInviteCopied,
      isInvitesLoading,
      refreshInvites,
    ],
  );
}
