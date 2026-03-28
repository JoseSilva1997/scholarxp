// Verifies ProfilePage route branches by mocking page-state so the shell stays testable as profile features expand.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from './ProfilePage';

const mocks = vi.hoisted(() => ({
  useProfilePageState: vi.fn(),
}));

function createStudentPageState() {
  return {
    user: {
      id: 7,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      globalRole: 'student',
      isVerified: true,
      hasInstitutionMembership: false,
      profilePictureUrl: null,
      avatar: null,
    },
    isStudent: true,
    isTutor: false,
    isLoading: false,
    studentProfile: {
      accountProgress: { level: 4 },
      masterQuestStreak: 6,
    },
    tutorProfile: undefined,
    moduleSortKey: 'strongest',
    setModuleSortKey: vi.fn(),
    isEditingProfile: false,
    setIsEditingProfile: vi.fn(),
  };
}

vi.mock('../../hooks/page-state/useProfilePageState', () => ({
  useProfilePageState: mocks.useProfilePageState,
}));

vi.mock('../../components/MainSection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

vi.mock('../../components/Profile/HeroCard', () => ({
  default: ({
    user,
    masterQuestStreak,
  }: {
    user: { firstName?: string | null };
    masterQuestStreak?: number;
  }) => (
    <div>
      hero-card:{user.firstName ?? 'unknown'}:{masterQuestStreak ?? 'none'}
    </div>
  ),
}));

vi.mock('../../components/Profile/StudentProfile', () => ({
  default: ({ moduleSortKey }: { moduleSortKey: string }) => (
    <div>student-profile:{moduleSortKey}</div>
  ),
}));

vi.mock('../../components/Profile/TutorProfile', () => ({
  default: () => <div>tutor-profile</div>,
}));

describe('ProfilePage route', () => {
  beforeEach(() => {
    mocks.useProfilePageState.mockReturnValue(createStudentPageState());
  });

  it('renders loading state while profile data is pending', () => {
    mocks.useProfilePageState.mockReturnValue({
      ...createStudentPageState(),
      user: null,
      isLoading: true,
      studentProfile: undefined,
    });

    render(<ProfilePage />);

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    expect(screen.queryByText(/hero-card:/)).not.toBeInTheDocument();
  });

  it('renders hero and student profile sections for student users', () => {
    render(<ProfilePage />);

    expect(screen.getByText('hero-card:Ada:6')).toBeInTheDocument();
    expect(screen.getByText('student-profile:strongest')).toBeInTheDocument();
    expect(screen.queryByText('tutor-profile')).not.toBeInTheDocument();
  });

  it('renders tutor profile content for tutor users', () => {
    mocks.useProfilePageState.mockReturnValue({
      user: {
        id: 11,
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        globalRole: 'teacher',
        isVerified: true,
        hasInstitutionMembership: true,
        profilePictureUrl: null,
        avatar: null,
      },
      isStudent: false,
      isTutor: true,
      isLoading: false,
      studentProfile: undefined,
      tutorProfile: {},
      moduleSortKey: 'strongest',
      setModuleSortKey: vi.fn(),
      isEditingProfile: true,
      setIsEditingProfile: vi.fn(),
    });

    render(<ProfilePage />);

    expect(screen.getByText('hero-card:Grace:none')).toBeInTheDocument();
    expect(screen.getByText('tutor-profile')).toBeInTheDocument();
    expect(screen.queryByText(/student-profile:/)).not.toBeInTheDocument();
  });
});
