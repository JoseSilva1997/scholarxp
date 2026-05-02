// Verifies the profile hero handles name editing, profile picture validation, and student progress display.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AccountProgress, AuthUser } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HeroCard from '@/Account/Profile/components/HeroCard';

const authMocks = vi.hoisted(() => ({
  setUser: vi.fn(),
}));
const apiMocks = vi.hoisted(() => ({
  updateName: vi.fn(),
  uploadProfilePicture: vi.fn(),
  removeProfilePicture: vi.fn(),
}));
const utilityMocks = vi.hoisted(() => ({
  cropImageToSquare: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    setUser: authMocks.setUser,
    applyStudentExpReward: vi.fn(),
    refreshUser: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/Account/api/users', () => ({
  updateName: apiMocks.updateName,
  uploadProfilePicture: apiMocks.uploadProfilePicture,
  removeProfilePicture: apiMocks.removeProfilePicture,
}));

vi.mock('@/utils/cropImageToSquare', () => ({
  cropImageToSquare: utilityMocks.cropImageToSquare,
}));

vi.mock('@/utils/logger', () => ({
  logError: utilityMocks.logError,
}));

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 42,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    profilePictureUrl: 'https://example.com/avatar.png',
    globalRole: 'student',
    isVerified: true,
    timezone: 'UTC',
    avatar: null,
    ...overrides,
  };
}

const accountProgress: AccountProgress = {
  id: 1,
  totalExp: 500,
  level: 5,
  currentLevelExp: 90,
  nextLevelExpRequired: 100,
  xpToNextLevel: 10,
  progressPercent: 90,
  equippedCosmetics: {},
};

describe('HeroCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.updateName.mockResolvedValue(buildUser({ firstName: 'Grace', lastName: 'Hopper' }));
    apiMocks.uploadProfilePicture.mockResolvedValue(buildUser({ profilePictureUrl: 'https://example.com/new.png' }));
    apiMocks.removeProfilePicture.mockResolvedValue(buildUser({ profilePictureUrl: '' }));
    utilityMocks.cropImageToSquare.mockResolvedValue(new Blob(['cropped'], { type: 'image/png' }));
  });

  it('renders student progress, streak, verification, and edit action', () => {
    const onEditProfile = vi.fn();

    render(
      <HeroCard
        user={buildUser()}
        accountProgress={accountProgress}
        masterQuestStreak={12}
        isEditingProfile={false}
        onEditProfile={onEditProfile}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'XP progress to next level' })).toHaveAttribute(
      'aria-valuenow',
      '90',
    );
    expect(screen.getByLabelText('Level 5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });

  it('validates and saves profile names while editing', async () => {
    render(
      <HeroCard
        user={buildUser()}
        accountProgress={accountProgress}
        isEditingProfile
        onEditProfile={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByRole('alert')).toHaveTextContent('First and last name are required.');

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Hopper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(apiMocks.updateName).toHaveBeenCalledWith(42, 'Grace', 'Hopper'));
    expect(authMocks.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Grace', lastName: 'Hopper' }),
    );
  });

  it('validates picture files and uploads cropped images', async () => {
    render(
      <HeroCard
        user={buildUser()}
        accountProgress={accountProgress}
        isEditingProfile
        onEditProfile={vi.fn()}
      />,
    );
    const input = screen.getByTestId('profile-picture-input');

    fireEvent.change(input, {
      target: { files: [new File(['avatar'], 'avatar.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Image must be PNG, JPEG, or WebP.');

    const png = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [png] } });

    await waitFor(() => expect(utilityMocks.cropImageToSquare).toHaveBeenCalledWith(png));
    expect(apiMocks.uploadProfilePicture).toHaveBeenCalledWith(42, expect.any(Blob));
    expect(authMocks.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ profilePictureUrl: 'https://example.com/new.png' }),
    );
  });

  it('removes an existing custom profile picture', async () => {
    render(
      <HeroCard
        user={buildUser()}
        accountProgress={accountProgress}
        isEditingProfile
        onEditProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(apiMocks.removeProfilePicture).toHaveBeenCalledWith(42));
    expect(authMocks.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ profilePictureUrl: '' }),
    );
  });

  it('renders teacher defaults without student-only progress, edit permissions, or verified badge', () => {
    render(
      <HeroCard
        user={buildUser({
          firstName: '',
          lastName: '',
          globalRole: 'pending',
          isVerified: false,
          profilePictureUrl: 'default.png',
        })}
        accountProgress={null}
        isEditingProfile
        onEditProfile={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByText('Teacher')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Email verified')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-picture-input')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('handles no-op name saves and name API failures', async () => {
    apiMocks.updateName.mockRejectedValueOnce(new Error('failed'));
    render(
      <HeroCard
        user={buildUser()}
        accountProgress={accountProgress}
        isEditingProfile
        onEditProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(apiMocks.updateName).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to update name. Please try again.'),
    );
    expect(utilityMocks.logError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'HeroCard.updateName',
    });
  });

  it('reports oversized picture files, upload failures, remove failures, and image fallback', async () => {
    utilityMocks.cropImageToSquare.mockRejectedValueOnce(new Error('crop failed'));
    apiMocks.removeProfilePicture.mockRejectedValueOnce(new Error('remove failed'));
    render(
      <HeroCard
        user={buildUser()}
        accountProgress={accountProgress}
        isEditingProfile
        onEditProfile={vi.fn()}
      />,
    );
    const input = screen.getByTestId('profile-picture-input');

    fireEvent.error(screen.getByAltText('Ada Lovelace profile picture'));
    expect(screen.getByAltText('Ada Lovelace profile picture')).toHaveAttribute(
      'src',
      expect.stringContaining('default-profile-pic'),
    );

    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' }),
        ],
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Image must be 5 MB or smaller.');

    fireEvent.change(input, {
      target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to update profile picture. Please try again.',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to remove profile picture. Please try again.',
      ),
    );
  });
});
