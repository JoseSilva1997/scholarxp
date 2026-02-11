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

    expect(screen.getByText('True')).toBeInTheDocument();
    expect(screen.getByText('False')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Extra')).not.toBeInTheDocument();
  });

  it('delegates explanation and correct-selection changes', () => {
    const onChangeExplanation = vi.fn();
    const onSelectCorrect = vi.fn();

    render(
      <TrueFalseForm
        options={options}
        onChangeOption={vi.fn()}
        onChangeExplanation={onChangeExplanation}
        onSelectCorrect={onSelectCorrect}
      />,
    );

    fireEvent.change(
      screen.getAllByPlaceholderText(
        'Explain why this option is correct or incorrect...',
      )[1],
      {
        target: { value: 'Updated explanation' },
      },
    );
    fireEvent.click(screen.getAllByRole('radio')[1]);

    expect(onChangeExplanation).toHaveBeenCalledWith('f', 'Updated explanation');
    expect(onSelectCorrect).toHaveBeenCalledWith('f');
  });
});
