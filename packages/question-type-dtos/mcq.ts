export type mcqQuestionDto = {
    options: [
        {
            optionText: string;
            explanation?: string
        },
        {
            optionText: string;
            explanation?: string
        },
        {
            optionText: string;
            explanation?: string
        },
        {
            optionText: string;
            explanation?: string
        }
    ];
    correctOptionIndex: number;
}

// Factory for an empty MCQ payload so downstream callers can track shape changes in one place.
export const emptyMcqTemplate = (): mcqQuestionDto => ({
    options: [
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
    ],
    correctOptionIndex: 0,
});
