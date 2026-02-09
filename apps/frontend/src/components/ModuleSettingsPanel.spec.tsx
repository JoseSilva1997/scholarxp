// Verifies settings panel composition with form and invite state hooks.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleSettingsPanel from './ModuleSettingsPanel';

const mocks = vi.hoisted(() => ({
  onToggle: vi.fn(),
  handleSubmit: vi.fn(),
  handleReset: vi.fn(),
  handleCreateInvite: vi.fn(),
  refreshInvites: vi.fn(),
  copyInviteLink: vi.fn(),
  handleRevokeInvite: vi.fn(),
  handleDeleteInvite: vi.fn(),
}));

vi.mock('../hooks/page-state/useModuleSettingsForm', () => ({
  useModuleSettingsForm: () => ({
    title: 'Module A',
    setTitle: vi.fn(),
    description: '',
    setDescription: vi.fn(),
    variantContext: '',
    setVariantContext: vi.fn(),
    isSaving: false,
    error: null,
    status: null,
    handleSubmit: mocks.handleSubmit,
    handleReset: mocks.handleReset,
  }),
}));

vi.mock('../hooks/page-state/useModuleInvitesPanelState', () => ({
  useModuleInvitesPanelState: () => ({
    invites: [{ id: 1, revokedAt: null, uses: 0, maxUses: 1, createdAt: new Date().toISOString(), expiresAt: null }],
    inviteError: null,
    isInvitesLoading: false,
    isCreatingInvite: false,
    createExpiry: 48,
    setCreateExpiry: vi.fn(),
    createMaxUses: 100,
    setCreateMaxUses: vi.fn(),
    refreshInvites: mocks.refreshInvites,
    handleCreateInvite: mocks.handleCreateInvite,
    handleRevokeInvite: mocks.handleRevokeInvite,
    handleDeleteInvite: mocks.handleDeleteInvite,
    formatExpiry: () => 'No expiry',
    canCopyInviteLink: () => true,
    isInviteCopied: () => false,
    copyInviteLink: mocks.copyInviteLink,
  }),
}));

describe('ModuleSettingsPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it('renders settings form and delegates submit/reset/toggle actions', () => {
    render(
      <ModuleSettingsPanel module={{ id: 1, title: 'Module A', institutionId: null }} isOpen onToggle={mocks.onToggle} onSaved={vi.fn()} canManageInvites />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse settings panel' }));
    expect(mocks.onToggle).toHaveBeenCalled();

    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
    expect(mocks.handleSubmit).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(mocks.handleReset).toHaveBeenCalled();
  });

  it('renders invite controls and delegates invite actions', () => {
    render(
      <ModuleSettingsPanel module={{ id: 1, title: 'Module A', institutionId: null }} isOpen onToggle={vi.fn()} onSaved={vi.fn()} canManageInvites />,
    );

    fireEvent.submit(screen.getByRole('button', { name: 'Create invite' }).closest('form')!);
    expect(mocks.handleCreateInvite).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mocks.refreshInvites).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }));
    expect(mocks.copyInviteLink).toHaveBeenCalled();
  });
});
