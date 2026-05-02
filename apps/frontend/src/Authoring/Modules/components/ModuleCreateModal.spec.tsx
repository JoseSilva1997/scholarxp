// Verifies module-create modal payload shaping.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ModuleCreateModal from '@/Authoring/Modules/components/ModuleCreateModal';

describe('ModuleCreateModal', () => {
  it('submits trimmed payload', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<ModuleCreateModal onClose={vi.fn()} onCreate={onCreate} isSaving={false} error={null} />);

    fireEvent.change(screen.getByRole('textbox', { name: /Title/i }), {
      target: { value: '  Module A  ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Description \(optional\)/i }), {
      target: { value: '  Desc  ' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Create module' }).closest('form')!);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ title: 'Module A', description: 'Desc' });
    });
  });
});
