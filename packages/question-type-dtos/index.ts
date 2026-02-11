// Central DTOs for question types shared across frontend and backend.
import { z } from 'zod';

/**
 * MCQ Question Data Schema
 */
export const McqQuestionSchema = z.object({
    options: z.tuple([
        z.object({ optionText: z.string().min(1, 'Option text is required'), explanation: z.string().optional() }),
        z.object({ optionText: z.string().min(1, 'Option text is required'), explanation: z.string().optional() }),
        z.object({ optionText: z.string().min(1, 'Option text is required'), explanation: z.string().optional() }),
        z.object({ optionText: z.string().min(1, 'Option text is required'), explanation: z.string().optional() }),
    ]),
    correctOptionIndex: z.number().min(0, 'Please select a correct option').max(3, 'Invalid option index'),
});

export type McqQuestionDto = z.infer<typeof McqQuestionSchema>;

export const emptyMcqTemplate = (): McqQuestionDto => ({
    options: [
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
        { optionText: '', explanation: '' },
    ] as any,
    correctOptionIndex: 0,
});

/**
 * True/False Question Data Schema
 */
const TrueFalseOptionSchema = z.object({
    isCorrect: z.boolean(),
    explanation: z.string().optional(),
});

export const TrueFalseQuestionSchema = z
    .object({
        trueOption: TrueFalseOptionSchema,
        falseOption: TrueFalseOptionSchema,
    })
    .superRefine((value, ctx) => {
        // Exactly one option must be marked correct; allowing both/neither would create ambiguous grading.
        if (value.trueOption.isCorrect === value.falseOption.isCorrect) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Select which option is correct before saving.',
            });
        }
    });

export type TrueFalseQuestionDto = z.infer<typeof TrueFalseQuestionSchema>;

/**
 * Union of all possible question content structures.
 */
export const QuestionDataSchema = z.union([
    McqQuestionSchema,
    TrueFalseQuestionSchema,
]);

export type QuestionData = z.infer<typeof QuestionDataSchema>;

/**
 * Runtime array of all supported question types.
 */
export const QUESTION_TYPES = ['mcq', 'true-false'] as const;

export type questionType = (typeof QUESTION_TYPES)[number];

/**
 * Default fallback question type for new or unknown content.
 */
export const DEFAULT_QUESTION_TYPE: questionType = 'mcq';
