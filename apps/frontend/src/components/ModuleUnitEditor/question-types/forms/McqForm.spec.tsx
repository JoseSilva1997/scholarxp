// Verifies MCQ form emits option and explanation change events.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { McqForm } from './McqForm';

const options = [
  { id: 'a', value: 'One', isCorrect: false, explanation: '' },
  { id: 'b', value: 'Two', isCorrect: true, explanation: 'because' },
];

describe('McqForm', () => {
  it('delegates option, explanation, and correct-selection handlers', () => {
    const onChangeOption = vi.fn();
    const onChangeExplanation = vi.fn();
    const onSelectCorrect = vi.fn();

    render(
      <McqForm
        options={options}
        onChangeOption={onChangeOption}
        onChangeExplanation={onChangeExplanation}
        onSelectCorrect={onSelectCorrect}
      />,
    );

    fireEvent.change(screen.getAllByPlaceholderText(/Option \d+ text\.\.\./)[0], { target: { value: 'New' } });
    fireEvent.change(screen.getAllByPlaceholderText('Explain why this is correct or incorrect...')[0], { target: { value: 'why' } });
    fireEvent.click(screen.getAllByRole('radio')[0]);

    expect(onChangeOption).toHaveBeenCalled();
    expect(onChangeExplanation).toHaveBeenCalled();
    expect(onSelectCorrect).toHaveBeenCalledWith('a');
  });
});
