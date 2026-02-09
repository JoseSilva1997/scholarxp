// Verifies true/false form renders two-option UI and forwards user edits through callbacks.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrueFalseForm } from './TrueFalseForm';

const options = [
  { id: 't', value: 'True', isCorrect: true, explanation: 'fact' },
  { id: 'f', value: 'False', isCorrect: false, explanation: 'not fact' },
  { id: 'x', value: 'Extra', isCorrect: false, explanation: 'ignore' },
];

describe('TrueFalseForm', () => {
  it('renders only the first two options', () => {
    render(
      <TrueFalseForm
        options={options}
        onChangeOption={vi.fn()}
        onChangeExplanation={vi.fn()}
        onSelectCorrect={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Enter Option 1 text...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter Option 2 text...')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Extra')).not.toBeInTheDocument();
  });

  it('delegates option, explanation, and correct-selection changes', () => {
    const onChangeOption = vi.fn();
    const onChangeExplanation = vi.fn();
    const onSelectCorrect = vi.fn();

    render(
      <TrueFalseForm
        options={options}
        onChangeOption={onChangeOption}
        onChangeExplanation={onChangeExplanation}
        onSelectCorrect={onSelectCorrect}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Enter Option 1 text...'), {
      target: { value: 'Updated true' },
    });
    fireEvent.change(
      screen.getAllByPlaceholderText(
        'Explain why this option is correct or incorrect...',
      )[1],
      {
        target: { value: 'Updated explanation' },
      },
    );
    fireEvent.click(screen.getAllByRole('radio')[1]);

    expect(onChangeOption).toHaveBeenCalledWith('t', 'Updated true');
    expect(onChangeExplanation).toHaveBeenCalledWith('f', 'Updated explanation');
    expect(onSelectCorrect).toHaveBeenCalledWith('f');
  });
});
