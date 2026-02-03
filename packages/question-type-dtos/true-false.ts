export type TrueFalseQuestionDto = {
    options:[
        {
            optionText: string; 
            explanation?: string; 
        },
        {
            optionText: string;
            explanation?: string;
        }
    ];
    correctOptionIndex: number;

};