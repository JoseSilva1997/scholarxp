// Verifies header branch rendering for authenticated and unauthenticated states,
// including student/non-student roles, avatar presence, and prop overrides.
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Header from './Header';
import type { AuthUser } from '../types/auth';

const queryMocks = vi.hoisted(() => ({
  useTodayQuestListQuery: vi.fn(),
}));

vi.mock('../hooks/queries/useQuestsQueries', () => ({
  useTodayQuestListQuery: queryMocks.useTodayQuestListQuery,
}));

// Mock UserBadge to track props passed to it, allowing assertion on level/exp values
type MockUserBadgeProps = {
  user?: AuthUser;
  level?: number;
  exp?: {
    current: number;
    max: number;
  };
  onLogout?: () => Promise<void> | void;
};

let mockUserBadgeProps: Partial<MockUserBadgeProps> = {};
vi.mock('./UserBadge', () => ({
  default: (props: unknown) => {
    // The test only needs level/exp, so we narrow incoming props to that minimal shape.
    if (props && typeof props === 'object') {
      mockUserBadgeProps = props as MockUserBadgeProps;
    }
    return <div data-testid="user-badge">user-badge</div>;
  },
}));

describe('Header', () => {
  beforeEach(() => {
    mockUserBadgeProps = {};
    queryMocks.useTodayQuestListQuery.mockReturnValue({
      data: { quests: [], completed: 0, max: 3 },
      isPending: false,
    });
  });

  // ============================================================================
  // Unauthenticated Branch: user is null/undefined
  // ============================================================================
  describe('Unauthenticated (no user)', () => {
    it('shows login and signup links when user is not present (null)', () => {
      renderWithProviders(
  <Header user={null} />,
);

      expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
      expect(screen.queryByTestId('user-badge')).not.toBeInTheDocument();
    });

    it('shows login and signup links when user is undefined', () => {
      renderWithProviders(
  <Header />,
);

      expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
      expect(screen.queryByTestId('user-badge')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Authenticated Branch: user exists and isStudent = true
  // ============================================================================
  describe('Student user with avatar', () => {
    const studentWithAvatar: AuthUser = {
      id: 1,
      firstName: 'Alice',
      lastName: 'Student',
      email: 'alice@example.com',
      profilePictureUrl: '',
      globalRole: 'student',
      isVerified: true,
      avatar: {
        id: 10,
        totalExp: 1000,
        level: 5,
        currentLevelExp: 200,
        nextLevelExpRequired: 318,
        xpToNextLevel: 118,
        progressPercent: 62.89,
      },
    };

    it('shows user badge when student user is present', () => {
      renderWithProviders(
  <Header user={studentWithAvatar} />,
);

      expect(screen.getByTestId('user-badge')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /today's quests/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    });

    it('opens the today quests popover when chip is clicked', () => {
      queryMocks.useTodayQuestListQuery.mockReturnValue({
        data: {
          quests: [
            {
              id: 11,
              moduleId: 4,
              moduleUnitId: null,
              moduleTitle: 'Biology',
              moduleUnitTitle: null,
              type: 'complete_daily_practice',
              description: 'Complete your daily practice for Biology.',
              expGranted: 25,
              isCompleted: false,
              questDateUtc: '2026-02-19',
              generatedAt: '2026-02-19T00:00:00.000Z',
              completedAt: null,
            },
          ],
          completed: 0,
          max: 3,
        },
        isPending: false,
      });

      renderWithProviders(
  <Header user={studentWithAvatar} />,
);

      fireEvent.click(screen.getByRole('button', { name: /today's quests/i }));

      expect(screen.getByTestId('today-quest-popover')).toBeInTheDocument();
      expect(screen.getByText('Quests')).toBeInTheDocument();
      expect(screen.getByText('Biology')).toBeInTheDocument();
    });

    it('closes the today quests popover when clicking outside', () => {
      renderWithProviders(
  <Header user={studentWithAvatar} />,
);

      fireEvent.click(screen.getByRole('button', { name: /today's quests/i }));
      expect(screen.getByTestId('today-quest-popover')).toBeInTheDocument();

      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('today-quest-popover')).not.toBeInTheDocument();
    });

    it('derives level from avatar when no prop override (isStudent=true path)', () => {
      renderWithProviders(
  <Header user={studentWithAvatar} />,
);

      // derivedLevel = 5 (from avatar), levelToShow uses nullish coalescing: studentLevel ?? derivedLevel
      expect(mockUserBadgeProps.level).toBe(5);
    });

    it('derives exp from avatar when no prop override (isStudent=true with avatar path)', () => {
      renderWithProviders(
  <Header user={studentWithAvatar} />,
);

      // derivedExp is mapped from account-progress fields.
      expect(mockUserBadgeProps.exp).toEqual({
        current: 200,
        max: 318,
      });
    });

    it('uses next-level requirement as exp max for avatar-driven display', () => {
      const highExpStudent: AuthUser = {
        ...studentWithAvatar,
        avatar: {
          ...studentWithAvatar.avatar!,
          currentLevelExp: 80,
          nextLevelExpRequired: 120,
        },
      };

      renderWithProviders(
        <Header user={highExpStudent} />,
      );

      expect(mockUserBadgeProps.exp).toEqual({
        current: 80,
        max: 120,
      });
    });

    it('overrides derived level with studentLevel prop (nullish coalescing)', () => {
      renderWithProviders(
  <Header user={studentWithAvatar} studentLevel={8} />,
);

      // studentLevel (8) ?? derivedLevel (5) = 8
      expect(mockUserBadgeProps.level).toBe(8);
    });

    it('overrides derived exp with studentExp prop (nullish coalescing)', () => {
      const customExp = { current: 300, max: 500 };
      renderWithProviders(
  <Header user={studentWithAvatar} studentExp={customExp} />,
);

      // studentExp ?? derivedExp
      expect(mockUserBadgeProps.exp).toEqual(customExp);
    });

    it('overrides both level and exp with prop values', () => {
      const customExp = { current: 100, max: 200 };
      renderWithProviders(
  <Header user={studentWithAvatar} studentLevel={12} studentExp={customExp} />,
);

      expect(mockUserBadgeProps.level).toBe(12);
      expect(mockUserBadgeProps.exp).toEqual(customExp);
    });
  });

  // ============================================================================
  // Student without avatar branch (isStudent=true but avatar undefined/null)
  // ============================================================================
  describe('Student user without avatar', () => {
    const studentNoAvatar: AuthUser = {
      id: 2,
      firstName: 'Bob',
      lastName: 'Student',
      email: 'bob@example.com',
      profilePictureUrl: '',
      globalRole: 'student',
      isVerified: true,
      // avatar is undefined
    };

    it('shows user badge for student without avatar', () => {
      renderWithProviders(
  <Header user={studentNoAvatar} />,
);

      expect(screen.getByTestId('user-badge')).toBeInTheDocument();
    });

    it('passes undefined level when student has no avatar (isStudent=true but !avatar path)', () => {
      renderWithProviders(
  <Header user={studentNoAvatar} />,
);

      // derivedLevel = undefined (isStudent but no avatar)
      // levelToShow = undefined ?? undefined = undefined
      expect(mockUserBadgeProps.level).toBeUndefined();
    });

    it('passes undefined exp when student has no avatar', () => {
      renderWithProviders(
  <Header user={studentNoAvatar} />,
);

      // derivedExp = undefined (isStudent but !avatar)
      expect(mockUserBadgeProps.exp).toBeUndefined();
    });

    it('uses studentLevel prop even when student has no avatar', () => {
      renderWithProviders(
  <Header user={studentNoAvatar} studentLevel={3} />,
);

      // studentLevel (3) ?? undefined = 3
      expect(mockUserBadgeProps.level).toBe(3);
    });

    it('uses studentExp prop even when student has no avatar', () => {
      const customExp = { current: 50, max: 150 };
      renderWithProviders(
  <Header user={studentNoAvatar} studentExp={customExp} />,
);

      expect(mockUserBadgeProps.exp).toEqual(customExp);
    });
  });

  // ============================================================================
  // Non-student user branch (isStudent = false)
  // ============================================================================
  describe('Non-student user (teacher, admin, etc.)', () => {
    const teacherUser: AuthUser = {
      id: 3,
      firstName: 'Charlie',
      lastName: 'Teacher',
      email: 'charlie@example.com',
      profilePictureUrl: '',
      globalRole: 'teacher',
      isVerified: true,
      avatar: {
        id: 20,
        totalExp: 3500,
        level: 10,
        currentLevelExp: 50,
        nextLevelExpRequired: 500,
        xpToNextLevel: 450,
        progressPercent: 10,
      },
    };

    it('shows user badge for non-student user', () => {
      renderWithProviders(
  <Header user={teacherUser} />,
);

      expect(screen.getByTestId('user-badge')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /today's quests/i })).not.toBeInTheDocument();
    });

    it('does not derive level for non-student (isStudent=false path)', () => {
      renderWithProviders(
  <Header user={teacherUser} />,
);

      // isStudent = false, so derivedLevel = undefined (ternary false branch)
      // levelToShow = undefined ?? undefined = undefined
      expect(mockUserBadgeProps.level).toBeUndefined();
    });

    it('does not derive exp for non-student', () => {
      renderWithProviders(
  <Header user={teacherUser} />,
);

      // isStudent = false, so derivedExp = undefined
      expect(mockUserBadgeProps.exp).toBeUndefined();
    });

    it('uses studentLevel prop override for non-student user', () => {
      renderWithProviders(
  <Header user={teacherUser} studentLevel={7} />,
);

      // studentLevel (7) ?? undefined = 7
      expect(mockUserBadgeProps.level).toBe(7);
    });

    it('uses studentExp prop override for non-student user', () => {
      const customExp = { current: 250, max: 750 };
      renderWithProviders(
  <Header user={teacherUser} studentExp={customExp} />,
);

      expect(mockUserBadgeProps.exp).toEqual(customExp);
    });

    it('admin user with no avatar uses prop overrides', () => {
      const adminUser: AuthUser = {
        id: 4,
        firstName: 'Diana',
        lastName: 'Admin',
        email: 'diana@example.com',
        profilePictureUrl: '',
        globalRole: 'admin',
        isVerified: true,
      };

      const customExp = { current: 0, max: 500 };
      renderWithProviders(
  <Header user={adminUser} studentLevel={1} studentExp={customExp} />,
);

      expect(mockUserBadgeProps.level).toBe(1);
      expect(mockUserBadgeProps.exp).toEqual(customExp);
    });
  });

  // ============================================================================
  // Edge case: zero/falsy values in props
  // ============================================================================
  describe('Edge cases with falsy values', () => {
    const studentWithAvatar: AuthUser = {
      id: 1,
      firstName: 'Alice',
      lastName: 'Student',
      email: 'alice@example.com',
      profilePictureUrl: '',
      globalRole: 'student',
      isVerified: true,
      avatar: {
        id: 10,
        totalExp: 1000,
        level: 5,
        currentLevelExp: 200,
        nextLevelExpRequired: 318,
        xpToNextLevel: 118,
        progressPercent: 62.89,
      },
    };

    it('studentLevel=0 overrides derived level (falsy but defined value)', () => {
      renderWithProviders(
  <Header user={studentWithAvatar} studentLevel={0} />,
);

      // studentLevel (0) is falsy but defined, nullish coalescing passes it through
      // 0 ?? 5 = 0
      expect(mockUserBadgeProps.level).toBe(0);
    });

    it('passes onLogout to UserBadge', () => {
      const mockLogout = vi.fn();
      renderWithProviders(
  <Header user={studentWithAvatar} onLogout={mockLogout} />,
);

      expect(mockUserBadgeProps.onLogout).toBe(mockLogout);
    });

    it('passes user to UserBadge', () => {
      renderWithProviders(
  <Header user={studentWithAvatar} />,
);

      expect(mockUserBadgeProps.user).toEqual(studentWithAvatar);
    });
  });

  // ============================================================================
  // Logo and brand rendering
  // ============================================================================
  describe('Header structure and branding', () => {
    it('renders the logo', () => {
      renderWithProviders(
  <Header />,
);

      const logo = screen.getByRole('link', { name: 'Go to landing page' });
      expect(logo).toBeInTheDocument();
      const img = logo.querySelector('img[alt="ScholarXP logo"]');
      expect(img).toBeInTheDocument();
    });

    it('renders the wordmark', () => {
      renderWithProviders(
  <Header />,
);

      expect(screen.getByText('ScholarXP')).toBeInTheDocument();
    });

    it('logo links to home page', () => {
      renderWithProviders(
  <Header />,
);

      const homeLink = screen.getByRole('link', { name: 'Go to landing page' });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('login button links to /login', () => {
      renderWithProviders(
  <Header />,
);

      const loginLink = screen.getByRole('link', { name: 'Login' });
      expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('signup button links to /register', () => {
      renderWithProviders(
  <Header />,
);

      const signupLink = screen.getByRole('link', { name: 'Sign up' });
      expect(signupLink).toHaveAttribute('href', '/register');
    });
  });
});
