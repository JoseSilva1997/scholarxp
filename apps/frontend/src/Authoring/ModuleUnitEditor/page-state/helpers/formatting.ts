// Provides formatting helpers for question and variant labels in the module-unit-editor.

// Builds a display label for a question, including draft status when unsaved.
export const formatQuestionLabel = (index: number, isDraft?: boolean) =>
  `Question ${index + 1}${isDraft ? ' (draft)' : ''}`;

// Builds a display label for a variant, including draft status when unsaved.
export const formatVariantLabel = (index: number, isDraft?: boolean) =>
  `Variant ${index + 1}${isDraft ? ' (draft)' : ''}`;
