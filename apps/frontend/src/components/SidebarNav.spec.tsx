// Verifies sidebar navigation filtering and action callbacks.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SidebarNav from './SidebarNav';

const mocks = vi.hoisted(() => ({
  toggleSidebar: vi.fn(),
  canUserAccess: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}));

vi.mock('../context/UiLayoutContext', () => ({
  useUiLayout: () => ({ toggleSidebar: mocks.toggleSidebar }),
}));

vi.mock('../permissions/permission', () => ({
  canUserAccess: mocks.canUserAccess,
}));

describe('SidebarNav', () => {
  beforeEach(() => {
    mocks.toggleSidebar.mockReset();
    mocks.canUserAccess.mockReset();
    mocks.canUserAccess.mockReturnValue(true);
  });

  it('renders nav items and triggers toggle + navigate callbacks', () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <SidebarNav onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation panel' }));
    expect(mocks.toggleSidebar).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Modules'));
    expect(onNavigate).toHaveBeenCalled();
  });

  it('hides unauthorized nav items', () => {
    mocks.canUserAccess.mockImplementation((feature: string) => feature !== 'navigation.quests');

    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Quests')).not.toBeInTheDocument();
    expect(screen.getByText('Modules')).toBeInTheDocument();
  });
});
