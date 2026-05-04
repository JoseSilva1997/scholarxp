// Verifies UI layout provider initializes from storage/media, persists, toggles, and guards hook usage.
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiLayoutProvider, useUiLayout } from '@/context/UiLayoutContext';

function Probe() {
  const { isSidebarOpen, setSidebarOpen, toggleSidebar } = useUiLayout();
  return (
    <>
      <div data-testid="state">{String(isSidebarOpen)}</div>
      <button type="button" onClick={toggleSidebar}>toggle</button>
      <button type="button" onClick={() => setSidebarOpen(true)}>open</button>
    </>
  );
}

function BrokenProbe() {
  useUiLayout();
  return null;
}

describe('UiLayoutContext', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it('initializes from media when no stored preference exists and persists changes', () => {
    render(
      <UiLayoutProvider>
        <Probe />
      </UiLayoutProvider>,
    );

    expect(screen.getByTestId('state')).toHaveTextContent('true');
    expect(localStorage.getItem('scholarxp:sidebar-open')).toBe('true');

    act(() => screen.getByRole('button', { name: 'toggle' }).click());
    expect(screen.getByTestId('state')).toHaveTextContent('false');
    expect(localStorage.getItem('scholarxp:sidebar-open')).toBe('false');

    act(() => screen.getByRole('button', { name: 'open' }).click());
    expect(screen.getByTestId('state')).toHaveTextContent('true');
  });

  it('initializes from stored preference before media preference', () => {
    localStorage.setItem('scholarxp:sidebar-open', 'false');

    render(
      <UiLayoutProvider>
        <Probe />
      </UiLayoutProvider>,
    );

    expect(screen.getByTestId('state')).toHaveTextContent('false');
  });

  it('throws when the hook is used outside the provider', () => {
    expect(() => render(<BrokenProbe />)).toThrow('useUiLayout must be used within UiLayoutProvider');
  });
});
