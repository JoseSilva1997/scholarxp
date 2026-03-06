// Provides formatting helpers for question and variant labels in the module-unit-editor.

export const formatQuestionLabel = (index: number, isDraft?: boolean) =>
  `Question ${index + 1}${isDraft ? ' (draft)' : ''}`;

export const formatVariantLabel = (index: number, isDraft?: boolean) =>
  `Variant ${index + 1}${isDraft ? ' (draft)' : ''}`;
