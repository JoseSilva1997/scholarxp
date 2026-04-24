// Verifies module-create modal payload shaping and role-gated institution field behavior.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleCreateModal from '@/Authoring/Modules/components/ModuleCreateModal';

const mocks = vi.hoisted(() => ({
  canUserAccess: vi.fn(),
}));

let user = { id: 1, globalRole: 'teacher' as const };

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user }),
}));

vi.mock('@/shared/permissions/permission', () => ({
  canUserAccess: mocks.canUserAccess,
}));

describe('ModuleCreateModal', () => {
  beforeEach(() => {
    user = { id: 1, globalRole: 'teacher' };
    mocks.canUserAccess.mockReset();
    mocks.canUserAccess.mockReturnValue(false);
  });

  it('submits trimmed payload without institution for non-privileged users', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<ModuleCreateModal onClose={vi.fn()} onCreate={onCreate} isSaving={false} error={null} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Module A  ' } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), { target: { value: '  Desc  ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create module' }).closest('form')!);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ title: 'Module A', description: 'Desc' });
    });
  });

  it('renders institution input and includes institutionId when permitted', async () => {
    mocks.canUserAccess.mockReturnValue(true);
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<ModuleCreateModal onClose={vi.fn()} onCreate={onCreate} isSaving={false} error={null} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Module B' } });
    fireEvent.change(screen.getByLabelText('Institution ID (required for institution admins)'), { target: { value: '42' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create module' }).closest('form')!);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ title: 'Module B', description: undefined, institutionId: 42 });
    });
  });
});
