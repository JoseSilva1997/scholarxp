// Verifies the lesson-complete modal timing so XP cannot be revealed before the
// celebration sequence has had time to play once on screen.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LessonCompleteModal from './LessonCompleteModal';

vi.mock('@/rewards/useCompletionMedal', () => ({
  useCompletionMedal: () => ({
    src: '/mock-medal.png',
    scale: 1,
  }),
}));

describe('LessonCompleteModal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <LessonCompleteModal isOpen={false} onDismiss={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the dismiss button disabled until the intro animation finishes', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <LessonCompleteModal
        isOpen
        unitTitle="Lesson 4"
        onDismiss={onDismiss}
      />,
    );

    const dismissButton = screen.getByRole('button', { name: 'Finishing…' });
    expect(dismissButton).toBeDisabled();
    fireEvent.click(dismissButton);
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
