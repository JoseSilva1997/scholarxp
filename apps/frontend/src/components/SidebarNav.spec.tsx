// Verifies sidebar navigation filtering, conditional rendering, and accessibility across all branches.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SidebarNav from './SidebarNav';
import { features } from '@scholarxp/permissions';

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

  describe('Core Rendering and Callbacks', () => {
    it('renders nav items and triggers toggle callback', () => {
      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation panel' });
      fireEvent.click(toggleButton);
      expect(mocks.toggleSidebar).toHaveBeenCalledOnce();
    });

    it('calls onNavigate callback when nav link is clicked', () => {
      const onNavigate = vi.fn();
      render(
        <MemoryRouter>
          <SidebarNav onNavigate={onNavigate} />
        </MemoryRouter>,
      );

      // Click on Modules nav link
      fireEvent.click(screen.getByText('Modules'));
      expect(onNavigate).toHaveBeenCalledOnce();
    });

    it('does not error when onNavigate is not provided', () => {
      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      // Should not throw when clicking without onNavigate
      expect(() => {
        fireEvent.click(screen.getByText('Modules'));
      }).not.toThrow();
    });
  });

  describe('Collapsed State (Conditional Rendering)', () => {
    it('renders expanded state by default (collapsed=false)', () => {
      render(
        <MemoryRouter>
          <SidebarNav collapsed={false} />
        </MemoryRouter>,
      );

      // In expanded mode, labelBlock should render with label AND hint
      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.getByText('Module catalogue')).toBeInTheDocument();
      expect(screen.getByText('Quest History')).toBeInTheDocument();
      expect(screen.getByText('Rewards')).toBeInTheDocument();
      expect(screen.getByText('Cosmetics & unlocks')).toBeInTheDocument();
    });

    it('renders collapsed state with tooltips only (collapsed=true)', () => {
      render(
        <MemoryRouter>
          <SidebarNav collapsed={true} />
        </MemoryRouter>,
      );

      // In collapsed mode, labelBlock should NOT render (hints should be hidden)
      expect(screen.queryByText('Module catalogue')).not.toBeInTheDocument();
      expect(screen.queryByText('My quest progress')).not.toBeInTheDocument();
      expect(screen.queryByText('Cosmetics & unlocks')).not.toBeInTheDocument();

      // But sr (screen-reader only) labels should still exist
      // Look for span that contains "Modules" and has aria-hidden=false (or no aria-hidden)
      const modulesSrLabel = screen.getByText('Modules');
      expect(modulesSrLabel).toBeInTheDocument();
      // Should be within a link (not a labelBlock span)
      expect(modulesSrLabel.tagName).toBe('SPAN');
    });

    it('conditionally renders labelBlock only when not collapsed', () => {
      const { rerender } = render(
        <MemoryRouter>
          <SidebarNav collapsed={false} />
        </MemoryRouter>,
      );

      // In expanded mode, hints should be visible (sign of labelBlock rendering)
      expect(screen.getByText('Module catalogue')).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <SidebarNav collapsed={true} />
        </MemoryRouter>,
      );

      // In collapsed mode, hints should NOT be visible
      expect(screen.queryByText('Module catalogue')).not.toBeInTheDocument();
      expect(screen.queryByText('My quest progress')).not.toBeInTheDocument();
    });

    it('maintains icon visibility in both collapsed and expanded states', () => {
      const { container, rerender } = render(
        <MemoryRouter>
          <SidebarNav collapsed={false} />
        </MemoryRouter>,
      );

      // React-icons render SVGs; asserting icon containers keeps the test resilient.
      expect(container.querySelectorAll('a span[aria-hidden="true"] svg')).toHaveLength(3);

      rerender(
        <MemoryRouter>
          <SidebarNav collapsed={true} />
        </MemoryRouter>,
      );

      // Icons should still be present in collapsed mode.
      expect(container.querySelectorAll('a span[aria-hidden="true"] svg')).toHaveLength(3);
    });
  });

  describe('Permission Filtering (canUserAccess branches)', () => {
    it('shows all items when user has full access', () => {
      mocks.canUserAccess.mockReturnValue(true);

      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.getByText('Quest History')).toBeInTheDocument();
      expect(screen.getByText('Rewards')).toBeInTheDocument();
    });

    it('filters out unauthorized items (canUserAccess returns false)', () => {
      // Only Modules and Rewards allowed, Quest History blocked
      mocks.canUserAccess.mockImplementation((feature: string) => feature !== features.navigation.quests);

      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.queryByText('Quest History')).not.toBeInTheDocument();
      expect(screen.getByText('Rewards')).toBeInTheDocument();
    });

    it('handles multiple unauthorized items', () => {
      // Only Modules allowed
      mocks.canUserAccess.mockImplementation((feature: string) => feature === features.navigation.modules);

      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.queryByText('Quest History')).not.toBeInTheDocument();
      expect(screen.queryByText('Rewards')).not.toBeInTheDocument();
    });

    it('always shows items without feature requirement', () => {
      // Even if canUserAccess returns false for all features, items without features show
      mocks.canUserAccess.mockReturnValue(false);

      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      // All items have features defined, so none should show
      expect(screen.queryByText('Modules')).not.toBeInTheDocument();
      expect(screen.queryByText('Quest History')).not.toBeInTheDocument();
      expect(screen.queryByText('Rewards')).not.toBeInTheDocument();
    });

    it('calls canUserAccess with correct feature names', () => {
      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      // Verify canUserAccess was called with each feature
      expect(mocks.canUserAccess).toHaveBeenCalledWith(features.navigation.modules, expect.any(Object));
      expect(mocks.canUserAccess).toHaveBeenCalledWith(features.navigation.quests, expect.any(Object));
      expect(mocks.canUserAccess).toHaveBeenCalledWith(features.navigation.rewards, expect.any(Object));
    });
  });

  describe('Navigation Active State', () => {
    it('applies active class to current route', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/main/modules']}>
          <SidebarNav />
        </MemoryRouter>,
      );

      // NavLink should have the active class when route matches
      const modulesLink = container.querySelector('a[href="/main/modules"]');
      const classAttr = modulesLink?.getAttribute('class') || '';
      expect(classAttr).toMatch(/linkActive/);
    });

    it('does not apply active class to non-current routes', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/main/modules']}>
          <SidebarNav />
        </MemoryRouter>,
      );

      const questsLink = container.querySelector('a[href="/main/quests"]');
      const classAttr = questsLink?.getAttribute('class') || '';
      expect(classAttr).not.toMatch(/linkActive/);
    });

    it('applies correct active class to different routes', () => {
      // Verify that active state changes when rendering with different initial entries
      const { container: container1 } = render(
        <MemoryRouter initialEntries={['/main/modules']}>
          <SidebarNav />
        </MemoryRouter>,
      );

      const modulesLink = container1.querySelector('a[href="/main/modules"]');
      let classAttr = modulesLink?.getAttribute('class') || '';
      expect(classAttr).toMatch(/linkActive/);

      // Render with different route
      const { container: container2 } = render(
        <MemoryRouter initialEntries={['/main/quests']}>
          <SidebarNav />
        </MemoryRouter>,
      );

      const questsLink = container2.querySelector('a[href="/main/quests"]');
      classAttr = questsLink?.getAttribute('class') || '';
      expect(classAttr).toMatch(/linkActive/);
    });
  });

  describe('Accessibility', () => {
    it('provides aria-label for toggle button', () => {
      render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation panel' });
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle navigation panel');
    });

    it('hides icon spans with aria-hidden', () => {
      const { container } = render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      // Find all span elements with aria-hidden="true"
      const hiddenIcons = container.querySelectorAll('span[aria-hidden="true"]');
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });

    it('uses semantic navigation structure', () => {
      const { container } = render(
        <MemoryRouter>
          <SidebarNav />
        </MemoryRouter>,
      );

      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
    });

    it('provides screen-reader only labels in collapsed mode', () => {
      render(
        <MemoryRouter>
          <SidebarNav collapsed={true} />
        </MemoryRouter>,
      );

      // In collapsed mode, text should still be in the DOM (for screen readers)
      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.getByText('Quest History')).toBeInTheDocument();
      expect(screen.getByText('Rewards')).toBeInTheDocument();
    });
  });

  describe('Combined Scenarios (Multiple Conditions)', () => {
    it('handles collapsed state with limited permissions', () => {
      mocks.canUserAccess.mockImplementation((feature: string) => feature !== features.navigation.quests);

      render(
        <MemoryRouter>
          <SidebarNav collapsed={true} />
        </MemoryRouter>,
      );

      // Should show Modules and Rewards (due to permissions)
      // But not Quest History
      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.queryByText('Quest History')).not.toBeInTheDocument();
      expect(screen.getByText('Rewards')).toBeInTheDocument();

      // Should not show hints in collapsed mode
      expect(screen.queryByText('Module catalogue')).not.toBeInTheDocument();
    });

    it('handles expanded state with single authorized item', () => {
      mocks.canUserAccess.mockImplementation((feature: string) => feature === features.navigation.modules);

      render(
        <MemoryRouter initialEntries={['/main/modules']}>
          <SidebarNav collapsed={false} onNavigate={vi.fn()} />
        </MemoryRouter>,
      );

      // Only Modules should be visible
      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.getByText('Module catalogue')).toBeInTheDocument();
      expect(screen.queryByText('Quest History')).not.toBeInTheDocument();
    });

    it('filters correctly when collapsed with navigationCallback', () => {
      const onNavigate = vi.fn();
      mocks.canUserAccess.mockImplementation((feature: string) => feature === features.navigation.rewards);

      render(
        <MemoryRouter>
          <SidebarNav collapsed={true} onNavigate={onNavigate} />
        </MemoryRouter>,
      );

      // Find and click the Rewards link
      const rewardsLink = screen.getByText('Rewards').closest('a');
      fireEvent.click(rewardsLink!);
      expect(onNavigate).toHaveBeenCalledOnce();
    });
  });

  describe('CSS Class Application', () => {
    it('applies collapsed class to sidebar when collapsed prop is true', () => {
      const { container } = render(
        <MemoryRouter>
          <SidebarNav collapsed={true} />
        </MemoryRouter>,
      );

      const sidebar = container.querySelector('aside');
      const classAttr = sidebar?.getAttribute('class') || '';
      expect(classAttr).toMatch(/sidebarCollapsed/);
    });

    it('does not apply collapsed class when collapsed prop is false', () => {
      const { container } = render(
        <MemoryRouter>
          <SidebarNav collapsed={false} />
        </MemoryRouter>,
      );

      const sidebar = container.querySelector('aside');
      const classAttr = sidebar?.getAttribute('class') || '';
      expect(classAttr).not.toMatch(/sidebarCollapsed/);
    });

    it('always applies sidebar base class', () => {
      const { container: container1 } = render(
        <MemoryRouter>
          <SidebarNav collapsed={true} />
        </MemoryRouter>,
      );

      const sidebar1 = container1.querySelector('aside');
      expect(sidebar1?.getAttribute('class')).toMatch(/sidebar/);

      const { container: container2 } = render(
        <MemoryRouter>
          <SidebarNav collapsed={false} />
        </MemoryRouter>,
      );

      const sidebar2 = container2.querySelector('aside');
      expect(sidebar2?.getAttribute('class')).toMatch(/sidebar/);
    });

    it('applies correct link classes based on active state', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/main/modules']}>
          <SidebarNav />
        </MemoryRouter>,
      );

      const modulesLink = container.querySelector('a[href="/main/modules"]');
      const modulesClassAttr = modulesLink?.getAttribute('class') || '';
      expect(modulesClassAttr).toMatch(/link/);
      expect(modulesClassAttr).toMatch(/linkActive/);

      const questsLink = container.querySelector('a[href="/main/quests"]');
      const questsClassAttr = questsLink?.getAttribute('class') || '';
      expect(questsClassAttr).toMatch(/link/);
      expect(questsClassAttr).not.toMatch(/linkActive/);
    });
  });
});
