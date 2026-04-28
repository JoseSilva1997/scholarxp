// Verifies profile cosmetics controls expose unlocked swaps and route to the rewards page.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CosmeticsSection from '@/Account/Profile/components/StudentProfile/CosmeticsSection';

const navigateMock = vi.fn();
const cosmeticsMocks = vi.hoisted(() => ({
  useCosmetics: vi.fn(),
  getCatalogBySlot: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/Rewards/cosmetics', () => ({
  ORDERED_SLOTS: ['theme', 'background'],
  SLOT_DISPLAY: {
    theme: { slot: 'theme', title: 'Theme', description: 'Theme colors' },
    background: { slot: 'background', title: 'Background', description: 'Backdrop' },
  },
  useCosmetics: cosmeticsMocks.useCosmetics,
  getCatalogBySlot: cosmeticsMocks.getCatalogBySlot,
}));

vi.mock('@/context/theme-context', () => ({
  themeFamilyFromRewardId: (id: string) => (id === 'dark' ? 'default' : id),
}));

function renderSection() {
  return render(
    <MemoryRouter>
      <CosmeticsSection />
    </MemoryRouter>,
  );
}

describe('CosmeticsSection', () => {
  const equipCosmetic = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cosmeticsMocks.useCosmetics.mockReturnValue({
      level: 20,
      equipped: { theme: 'dark', background: 'plain' },
      equipCosmetic,
      isEquipping: false,
    });
    cosmeticsMocks.getCatalogBySlot.mockImplementation((slot: string) => {
      if (slot === 'theme') {
        return [
          { id: 'light', name: 'Light', description: 'Default', unlocksAtLevel: 1 },
          { id: 'dark', name: 'Dark', description: 'Dark', unlocksAtLevel: 1 },
          { id: 'aurora', name: 'Aurora', description: 'Green', unlocksAtLevel: 10 },
        ];
      }
      return [{ id: 'plain', name: 'Plain', description: 'Default', unlocksAtLevel: 1 }];
    });
  });

  it('shows theme choices, maps legacy default theme ids, and equips inactive chips', () => {
    renderSection();

    expect(screen.getByRole('button', { name: 'Default - Theme' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Aurora' }));

    expect(equipCosmetic).toHaveBeenCalledWith('theme', 'aurora');
  });

  it('routes users to the full rewards page', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'View rewards' }));

    expect(navigateMock).toHaveBeenCalledWith('/main/rewards');
  });

  it('renders an empty prompt when no slot has multiple unlocked options', () => {
    cosmeticsMocks.getCatalogBySlot.mockReturnValue([
      { id: 'plain', name: 'Plain', description: 'Default', unlocksAtLevel: 1 },
    ]);

    renderSection();

    expect(
      screen.getByText('Keep levelling up to unlock cosmetics you can swap here!'),
    ).toBeInTheDocument();
  });
});
