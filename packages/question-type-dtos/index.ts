// Central DTOs for question types shared across frontend and backend.

/**
 * MCQ Question Data
 */
export type McqQuestionDto = {
    options: [
        { optionText: string; explanation?: string },
        { optionText: string; explanation?: string },
        { optionText: string; explanation?: string },
        { optionText: string; explanation?: string }
    ];
    correctOptionIndex: number;
}

export const emptyMcqTemplate = (): McqQuestionDto => ({
    options: [
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
    ],
    correctOptionIndex: 0,
});

/**
 * True/False Question Data
 */
export type TrueFalseQuestionDto = {
    options: [
        { optionText: string; explanation?: string },
        { optionText: string; explanation?: string }
    ];
    correctOptionIndex: number;
};

/**
 * Union of all possible question content structures.
 */
export type QuestionData = McqQuestionDto | TrueFalseQuestionDto;

/**
 * Runtime array of all supported question types.
 */
export const QUESTION_TYPES = ['mcq', 'true-false'] as const;

export type questionType = (typeof QUESTION_TYPES)[number];

/**
 * Default fallback question type for new or unknown content.
 */
export const DEFAULT_QUESTION_TYPE: questionType = 'mcq';
