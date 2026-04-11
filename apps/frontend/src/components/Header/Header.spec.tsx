// Verifies header branch rendering for authenticated and unauthenticated states,
// including student/non-student roles, avatar presence, and prop overrides.
import { screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import type { AuthUser } from '@/types/auth';
import Header from './Header';

vi.mock('./StudentQuestHeaderStatus', () => ({
  default: ({ userId }: { userId: number }) => (
    <div data-testid="student-quest-header-status">
      student-quest-header-status:{userId}
    </div>
  ),
}));

// Mock UserBadge to track props passed to it, allowing assertion on level/exp values
type MockUserBadgeProps = {
  user?: AuthUser;
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
      timezone: 'UTC',
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
      expect(screen.getByTestId('student-quest-header-status')).toHaveTextContent(
        'student-quest-header-status:1',
      );
      expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    });

    it('passes student avatar data to UserBadge through user prop', () => {
      renderWithProviders(
        <Header user={studentWithAvatar} />,
      );

      expect(mockUserBadgeProps.user).toEqual(studentWithAvatar);
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
      timezone: 'UTC',
      // avatar is undefined
    };

    it('shows user badge for student without avatar', () => {
      renderWithProviders(
  <Header user={studentNoAvatar} />,
);

      expect(screen.getByTestId('user-badge')).toBeInTheDocument();
    });

    it('passes student without avatar to UserBadge', () => {
      renderWithProviders(
        <Header user={studentNoAvatar} />,
      );

      expect(mockUserBadgeProps.user).toEqual(studentNoAvatar);
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
      timezone: 'UTC',
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
      expect(
        screen.queryByTestId('student-quest-header-status'),
      ).not.toBeInTheDocument();
    });

    it('passes non-student users to UserBadge unchanged', () => {
      const adminUser: AuthUser = {
        id: 4,
        firstName: 'Diana',
        lastName: 'Admin',
        email: 'diana@example.com',
        profilePictureUrl: '',
        globalRole: 'admin',
        isVerified: true,
        timezone: 'UTC',
      };

      renderWithProviders(
        <Header user={adminUser} />,
      );

      expect(mockUserBadgeProps.user).toEqual(adminUser);
    });
  });

  describe('UserBadge props', () => {
    const studentWithAvatar: AuthUser = {
      id: 1,
      firstName: 'Alice',
      lastName: 'Student',
      email: 'alice@example.com',
      profilePictureUrl: '',
      globalRole: 'student',
      isVerified: true,
      timezone: 'UTC',
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
