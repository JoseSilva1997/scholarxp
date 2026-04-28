// Verifies student header status composes the two student-only progress widgets with the same user id.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudentQuestHeaderStatus from '@/MainApp/Header/components/StudentQuestHeaderStatus';

const childMocks = vi.hoisted(() => ({
  today: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/MainApp/Header/components/TodayQuestChip', () => ({
  default: (props: { userId: number }) => {
    childMocks.today(props);
    return <div>today-{props.userId}</div>;
  },
}));

vi.mock('@/MainApp/Header/components/DailyLessonXpTrackChip', () => ({
  default: (props: { userId: number }) => {
    childMocks.track(props);
    return <div>track-{props.userId}</div>;
  },
}));

describe('StudentQuestHeaderStatus', () => {
  it('passes user id to both header widgets', () => {
    render(<StudentQuestHeaderStatus userId={42} />);

    expect(screen.getByText('today-42')).toBeInTheDocument();
    expect(screen.getByText('track-42')).toBeInTheDocument();
    expect(childMocks.today).toHaveBeenCalledWith({ userId: 42 });
    expect(childMocks.track).toHaveBeenCalledWith({ userId: 42 });
  });
});
