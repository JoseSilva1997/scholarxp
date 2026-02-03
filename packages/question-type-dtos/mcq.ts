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
