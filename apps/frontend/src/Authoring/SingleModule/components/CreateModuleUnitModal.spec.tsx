// Verifies create-unit modal validation and submit/cancel behavior.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateModuleUnitModal from '@/Authoring/SingleModule/components/CreateModuleUnitModal';

describe('CreateModuleUnitModal', () => {
  it('does not render when closed', () => {
    const { container } = render(<CreateModuleUnitModal isOpen={false} onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('submits trimmed title and closes', () => {
    const onClose = vi.fn();
    const onCreate = vi.fn();

    render(<CreateModuleUnitModal isOpen onClose={onClose} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Unit A  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }));

    expect(onCreate).toHaveBeenCalledWith('Unit A');
    expect(onClose).toHaveBeenCalled();
  });
});
