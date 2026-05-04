// Verifies tutor profile renders teaching metrics, modules, activity, and editable-state messaging.
import { fireEvent, render, screen } from '@testing-library/react';
import type { TutorProfileResponse } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TutorProfile from '@/Account/Profile/components/TutorProfile';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function buildProfile(overrides: Partial<TutorProfileResponse> = {}): TutorProfileResponse {
  return {
    modulesCreated: 2,
    liveLessonsPublished: 5,
    totalEnrolledStudents: 12,
    studentsActiveLast7Days: 8,
    pendingInvites: 1,
    modules: [
      {
        moduleId: 77,
        title: 'Algebra',
        studentCount: 6,
        liveLessons: 3,
        draftLessons: 1,
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
    recentActivity: [
      {
        type: 'publish',
        description: 'Published Lesson 1',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        type: 'invite_accepted',
        description: 'Sam joined',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    profile: {
      name: 'Prof Ada',
      email: 'ada@example.com',
      role: 'Teacher',
      bio: null,
    },
    ...overrides,
  };
}

describe('TutorProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview metrics, modules, activity, and profile details', () => {
    render(<TutorProfile profile={buildProfile()} isEditing={false} />);

    expect(screen.getByText('Teaching Overview')).toBeInTheDocument();
    expect(screen.getByText('Active Invitation Links')).toBeInTheDocument();
    expect(screen.getByText('Algebra')).toBeInTheDocument();
    expect(screen.getByText('Published Lesson 1')).toBeInTheDocument();
    expect(screen.getByText('Add a bio...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Module' }));
    expect(navigateMock).toHaveBeenCalledWith('/main');

    fireEvent.click(screen.getByRole('button', { name: 'Open Module' }));
    expect(navigateMock).toHaveBeenCalledWith('/main/modules/77');
  });

  it('renders empty states and edit placeholder when no teaching data exists', () => {
    render(
      <TutorProfile
        profile={buildProfile({
          pendingInvites: 0,
          modules: [],
          recentActivity: [],
          profile: {
            name: 'Prof Ada',
            email: null,
            role: 'Teacher',
            bio: 'Maths tutor',
          },
        })}
        isEditing
      />,
    );

    expect(screen.queryByRole('button', { name: 'Manage Invites' })).not.toBeInTheDocument();
    expect(screen.getByText('No modules created yet. Start by creating your first module!')).toBeInTheDocument();
    expect(screen.getByText('No recent activity yet. Publish a lesson or invite students to get started!')).toBeInTheDocument();
    expect(screen.getByText('Profile editing is coming soon.')).toBeInTheDocument();
    expect(screen.getByText('Maths tutor')).toBeInTheDocument();
  });
});
