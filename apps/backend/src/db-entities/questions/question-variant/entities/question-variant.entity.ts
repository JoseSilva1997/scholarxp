// Links an alternative content version to a question unit. Variants allow instructors to provide
// multiple phrasings of the same question; the daily-practice algorithm selects among them.
export class QuestionVariant {
  id: number;
  questionUnitId: number;
  // FK to the QuestionContent row that holds the variant's stem and structured data.
  contentId: number;
  variantLabel: string;
  createdAt: Date;
  updatedAt: Date;
}
