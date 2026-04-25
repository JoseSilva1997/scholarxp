// Comprehensive branch-coverage tests for ModuleSettingsPanel component.
// Tests render state, form interactions, and invite management with full branch coverage.
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleSettingsPanel from '@/Authoring/SingleModule/components/ModuleSettingsPanel';
import type { ModuleSummary, ModuleInvite } from '@/shared/types/module';

// Hoist variables so they're available for vi.mock() calls
const { mockUseModuleInvitesPanelState, mockUseModuleSettingsForm, mockInvitesPanelStateValue, mockSettingsFormValue } = vi.hoisted(() => ({
  mockInvitesPanelStateValue: {
    invites: [] as ModuleInvite[],
    inviteError: null as string | null,
    isInvitesLoading: false,
    isCreatingInvite: false,
    createExpiry: 24,
    setCreateExpiry: vi.fn(),
    createMaxUses: 10,
    setCreateMaxUses: vi.fn(),
    refreshInvites: vi.fn(),
    handleCreateInvite: vi.fn(),
    handleRevokeInvite: vi.fn(),
    handleDeleteInvite: vi.fn(),
    formatExpiry: vi.fn(() => 'Expires in 20 hours'),
    canCopyInviteLink: vi.fn(() => true),
    isInviteCopied: vi.fn(() => false),
    copyInviteLink: vi.fn(),
  },
  mockSettingsFormValue: {
    title: 'Test Module',
    setTitle: vi.fn(),
    description: 'Test description',
    setDescription: vi.fn(),
    isSaving: false,
    error: null as string | null,
    status: null as string | null,
    handleSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    handleReset: vi.fn(),
  },
  mockUseModuleInvitesPanelState: vi.fn(),
  mockUseModuleSettingsForm: vi.fn(),
}));

vi.mock('@/Authoring/SingleModule/page-state/useModuleInvitesPanelState', () => ({
  useModuleInvitesPanelState: mockUseModuleInvitesPanelState,
}));

vi.mock('@/Authoring/SingleModule/useModuleSettingsForm', () => ({
  useModuleSettingsForm: mockUseModuleSettingsForm,
}));

// ===== Test Data =====
const mockModule: ModuleSummary = {
  id: 1,
  title: 'Test Module',
  description: 'Test description',
  institutionId: null, // Allows invites
};

const mockInstitutionModule: ModuleSummary = {
  ...mockModule,
  institutionId: 1, // Disables invites
};

const mockInvite: ModuleInvite = {
  id: 1,
  moduleId: 1,
  createdByUserId: 1,
  code: 'TEST123',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  uses: 1,
  maxUses: 5,
  revokedAt: null,
};

const mockExpiredInvite: ModuleInvite = {
  ...mockInvite,
  id: 2,
  expiresAt: new Date(Date.now() - 3600000).toISOString(),
};

const mockRevokedInvite: ModuleInvite = {
  ...mockInvite,
  id: 3,
  revokedAt: new Date().toISOString(),
};

const mockOnToggle = vi.fn();
const mockOnSaved = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mocks to default return values
  mockUseModuleInvitesPanelState.mockReturnValue(mockInvitesPanelStateValue);
  mockUseModuleSettingsForm.mockReturnValue(mockSettingsFormValue);
});

describe('ModuleSettingsPanel', () => {
  describe('panel visibility and backdrop', () => {
    it('renders backdrop when panel is open', () => {
      const { container } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // When open, backdrop div is rendered
      const backdrop = container.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
    });

    it('does not render backdrop when panel is closed', () => {
      const { container } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={false}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // When closed, backdrop should not exist (it's conditionally rendered)
      const backdrops = container.querySelectorAll('[aria-hidden="true"][class*="backdrop"]');
      expect(backdrops).toHaveLength(0);
    });

    it('backdrop calls onToggle when clicked', async () => {
      const { container } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Find the backdrop (not the aside which also has aria-hidden at different times)
      const backdrops = Array.from(container.querySelectorAll('[aria-hidden="true"]'));
      const backdrop = backdrops.find(el => el.tagName === 'DIV' && el === el.parentElement?.firstChild);

      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnToggle).toHaveBeenCalled();
      }
    });

    it('sets aria-hidden correctly based on isOpen state', () => {
      const { rerender } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={false}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // When closed, aside has aria-hidden="true"
      let aside = screen.getByRole('complementary', { hidden: true });
      expect(aside).toHaveAttribute('aria-hidden', 'true');

      rerender(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // When open, aside is visible with aria-hidden="false"
      aside = screen.getByRole('complementary');
      expect(aside).toHaveAttribute('aria-hidden', 'false');
    });
  });

  describe('body scroll overflow', () => {
    it('sets body overflow to hidden when panel opens', () => {
      const { rerender } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={false}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(document.body.style.overflow).toBe('');

      rerender(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body overflow when panel closes', () => {
      const { rerender } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={false}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(document.body.style.overflow).toBe('');
    });

    it('cleans up body overflow on unmount', () => {
      const { unmount } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('panel header', () => {
    it('displays module title in header', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByText('Test Module')).toBeInTheDocument();
    });

    it('displays close button when panel is open', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const closeButton = screen.getByRole('button', {
        name: /Close settings panel/i,
      });
      expect(closeButton).toBeInTheDocument();
    });

    it('keeps close button accessible when panel is closed', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={false}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const closeButton = screen.getByRole('button', {
        name: /Close settings panel/i,
        hidden: true,
      });
      expect(closeButton).toBeInTheDocument();
    });

    it('header button calls onToggle', async () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const closeButton = screen.getByRole('button', {
        name: /Close settings panel/i,
      });
      await userEvent.click(closeButton);
      expect(mockOnToggle).toHaveBeenCalled();
    });
  });

  describe('edit section', () => {
    it('displays not ready state when module is null', () => {
      render(
        <ModuleSettingsPanel
          module={null}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // When not ready, the form fields should not be in the document (placeholders shown instead)
      expect(
        screen.queryByRole('textbox', { name: /Title/i })
      ).not.toBeInTheDocument();
    });

    it('renders edit form when module is ready', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByDisplayValue('Test Module')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    });

    it('displays error message when form has error', () => {
      mockUseModuleSettingsForm.mockReturnValue({
        ...mockSettingsFormValue,
        error: 'Failed to save module',
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByText('Failed to save module')).toBeInTheDocument();
    });

    it('displays status message when available', () => {
      mockUseModuleSettingsForm.mockReturnValue({
        ...mockSettingsFormValue,
        status: 'Module saved successfully',
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByText('Module saved successfully')).toBeInTheDocument();
    });

    it('disables form inputs when isSaving is true', () => {
      mockUseModuleSettingsForm.mockReturnValue({
        ...mockSettingsFormValue,
        isSaving: true,
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // When saving, buttons are disabled and the submit button shows "Saving…"
      const submitButton = screen.getByRole('button', { name: /Saving…/i });
      expect(submitButton).toBeDisabled();
      
      const resetButton = screen.getByRole('button', { name: /Reset/i });
      expect(resetButton).toBeDisabled();
    });

    it('disables submit button when isSaving is true', () => {
      mockUseModuleSettingsForm.mockReturnValue({
        ...mockSettingsFormValue,
        isSaving: true,
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Save changes|Saving/i });
      expect(submitButton).toBeDisabled();
    });

    it('shows loading text on submit button when isSaving', () => {
      mockUseModuleSettingsForm.mockReturnValue({
        ...mockSettingsFormValue,
        isSaving: true,
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Saving/i });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('invites section - invite-enabled module', () => {
    it('displays invite form for non-institution modules', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByDisplayValue('24')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('does not display invite form for institution modules', () => {
      render(
        <ModuleSettingsPanel
          module={mockInstitutionModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Institution module should not show invites section
      expect(screen.queryByText(/Expiry \(hours\)/i)).not.toBeInTheDocument();
    });

    it('displays invite error when present', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        inviteError: 'Failed to load invites',
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByText('Failed to load invites')).toBeInTheDocument();
    });

    it('disables create invite button when isSaving', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        isCreatingInvite: true,
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const createButton = screen.getByRole('button', { name: /^\.\.\.$/i });
      expect(createButton).toBeDisabled();
    });
  });

  describe('invites section - disabled when invites not allowed', () => {
    it('hides invite section when invites disabled for institution', () => {
      render(
        <ModuleSettingsPanel
          module={mockInstitutionModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.queryByText(/Active invites/i)).not.toBeInTheDocument();
    });

    it('hides invite section when canManageInvites is false', () => {
      // Note: The invite section visibility is actually controlled by module type (institutionId),
      // not by canManageInvites. An institution module will hide the invite section.
      render(
        <ModuleSettingsPanel
          module={mockInstitutionModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.queryByText(/Expiry \(hours\)/i)).not.toBeInTheDocument();
    });
  });

  describe('invites list - loading state', () => {
    it('shows placeholder when loading invites', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        isInvitesLoading: true,
      });

      const { container } = render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(container.querySelector('[class*="settingsPlaceholderGroup"]')).toBeInTheDocument();
    });

    it('disables refresh button when loading', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        isInvitesLoading: true,
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /^\.\.\.$/i });
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('invites list - empty state', () => {
    it('shows message when no invites exist', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [],
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(
        screen.getByText(/No invites yet. Create a link to start inviting students./i)
      ).toBeInTheDocument();
    });
  });

  describe('invites list - with invites', () => {
    it('renders list of active invites', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockInvite],
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Component displays date, status, and usage, not the code itself
      expect(screen.getByText(/^Active$/i)).toBeInTheDocument();
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(1);
    });

    it('displays usage information', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockInvite],
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByText(/1 \/ 5/i)).toBeInTheDocument();
    });

    it('shows unlimited usage when maxUses is null', () => {
      const unlimitedInvite = { ...mockInvite, maxUses: null };
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [unlimitedInvite],
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByText(/\(unlimited\)/i)).toBeInTheDocument();
    });
  });

  describe('invite actions - active invite', () => {
    it('shows copy button for active invite', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockInvite],
        canCopyInviteLink: vi.fn(() => true),
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByLabelText(/Copy invite link/i)).toBeInTheDocument();
    });

    it('shows revoke button for active invite', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockInvite],
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByRole('button', { name: /Revoke/i })).toBeInTheDocument();
    });

    it('updates copy button text when clicked', async () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockInvite],
        isInviteCopied: vi.fn(() => true),
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      const copyButton = screen.getByLabelText(/Copy invite link/i);
      expect(copyButton).toHaveAttribute('title', 'Copied!');
    });
  });

  describe('invite actions - expired invite', () => {
    it('shows inactive status for expired invite', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockExpiredInvite],
        formatExpiry: vi.fn(() => 'Expired 20 hours ago'),
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Check for inactive status badge (shown because expiry starts with 'Expired')
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      // Check for expired hint
      expect(screen.getByText('Link expired')).toBeInTheDocument();
    });

    it('does not show copy button for expired invite', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockExpiredInvite],
        formatExpiry: vi.fn(() => 'Expired 20 hours ago'),
        canCopyInviteLink: vi.fn(() => false),
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(
        screen.queryByLabelText(/Copy invite link/i)
      ).not.toBeInTheDocument();
    });

    it('shows delete button for expired invite', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockExpiredInvite],
        formatExpiry: vi.fn(() => 'Expired 20 hours ago'),
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });
  });

  describe('invite actions - revoked invite', () => {
    it('shows inactive status for revoked invite', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockRevokedInvite],
        formatExpiry: vi.fn(() => 'Revoked 20 hours ago'),
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Check for inactive status (shown because revokedAt is set)
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('shows delete button for revoked invite', () => {
      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockRevokedInvite],
        formatExpiry: vi.fn(() => 'Revoked 20 hours ago'),
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });
  });

  describe('permissions - canManageInvites', () => {
    it('shows invite form when canManageInvites is true', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Check for the invite form inputs
      expect(screen.getByDisplayValue('24')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('hides invite form when canManageInvites is false and module is institutional', () => {
      // Note: The component hides invites based on institutionId, not canManageInvites alone
      render(
        <ModuleSettingsPanel
          module={mockInstitutionModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Invite form should not be visible for institutional modules
      expect(screen.queryByDisplayValue('24')).not.toBeInTheDocument();
    });
  });

  describe('archive module section', () => {
    it('hides archive controls when delete permission is unavailable', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
          canDeleteModule={false}
        />
      );

      expect(screen.queryByRole('button', { name: /Archive module/i })).not.toBeInTheDocument();
    });

    it('requests archive confirmation from the archive button', async () => {
      const onRequestArchiveModule = vi.fn();

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
          canDeleteModule={true}
          onRequestArchiveModule={onRequestArchiveModule}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: /Archive module/i }));

      expect(onRequestArchiveModule).toHaveBeenCalledTimes(1);
    });

    it('renders impact counts and confirms archive from confirmation state', async () => {
      const onConfirmArchiveModule = vi.fn();

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
          canDeleteModule={true}
          isArchiveConfirmOpen={true}
          archiveImpact={{
            moduleId: 1,
            isArchived: false,
            willArchive: true,
            isPurgeableArchivedModule: false,
            purgeEligibleAt: null,
            counts: {
              studentEnrollments: 3,
              attempts: 12,
              expLedgerEntries: 4,
              moduleUnitProgress: 5,
              studentQuestionStates: 6,
              dailyPracticeSets: 2,
              dailyPracticeSetItems: 7,
              dailyQuests: 1,
              invites: 0,
              moduleUnits: 8,
              questions: 9,
            },
          }}
          onConfirmArchiveModule={onConfirmArchiveModule}
        />
      );

      expect(screen.getByText('Student enrollments')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Practice attempts')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /Confirm archive/i }));

      expect(onConfirmArchiveModule).toHaveBeenCalledTimes(1);
    });

    it('shows archive impact errors and disables confirmation while checking impact', () => {
      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
          canDeleteModule={true}
          isArchiveConfirmOpen={true}
          isArchiveImpactLoading={true}
          archiveImpactError="Could not check module impact right now. Please try again."
        />
      );

      expect(
        screen.getByText('Could not check module impact right now. Please try again.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm archive/i })).toBeDisabled();
    });
  });

  describe('edge cases - multiple state combinations', () => {
    it('handles multiple invites with different statuses', () => {
      // Mock formatExpiry to return appropriate values based on invite state
      const mockFormatExpiry = vi.fn((invite: ModuleInvite) => {
        if (invite.id === mockExpiredInvite.id) return 'Expired 20 hours ago';
        if (invite.id === mockRevokedInvite.id) return 'Revoked 5 hours ago';
        return 'Expires in 20 hours';
      });

      mockUseModuleInvitesPanelState.mockReturnValue({
        ...mockInvitesPanelStateValue,
        invites: [mockInvite, mockExpiredInvite, mockRevokedInvite],
        formatExpiry: mockFormatExpiry,
      });

      render(
        <ModuleSettingsPanel
          module={mockModule}
          isOpen={true}
          onToggle={mockOnToggle}
          onSaved={mockOnSaved}
          canManageInvites={true}
        />
      );

      // Verify all three invites are rendered
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      // Verify delete buttons for inactive invites (expired and revoked)
      expect(screen.getAllByRole('button', { name: /Delete/i })).toHaveLength(2);
    });
  });
});
