// Validates and coerces query parameters for roster list endpoints so service code can trust input shapes.
import { IsIn, IsOptional, IsString } from 'class-validator';
import type {
  RosterLessonsQuery,
  RosterReviewQuery,
  RosterStudentsQuery,
  RosterStudentFilter,
  RosterStudentSortBy,
  RosterLessonSortBy,
  RosterReviewSortBy,
  SortDirection,
} from '@scholarxp/api-contracts';

const STUDENT_FILTERS: RosterStudentFilter[] = [
  'all',
  'active_7d',
  'inactive_7d',
  'at_risk',
  'daily_practice_locked',
  'daily_practice_unlocked',
];

const STUDENT_SORTS: RosterStudentSortBy[] = [
  'name',
  'last_activity',
  'completed_lessons',
  'due_review_count',
];

const LESSON_SORTS: RosterLessonSortBy[] = [
  'title',
  'completion_rate',
  'average_mastery',
  'last_practiced',
];

const REVIEW_SORTS: RosterReviewSortBy[] = [
  'name',
  'due_review_count',
  'overdue_review_count',
  'lapse_count',
];

const SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];

export class RosterStudentsQueryDto implements RosterStudentsQuery {
  @IsOptional()
  @IsIn(STUDENT_FILTERS)
  filter?: RosterStudentFilter;

  @IsOptional()
  @IsIn(STUDENT_SORTS)
  sortBy?: RosterStudentSortBy;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDirection?: SortDirection;

  @IsOptional()
  @IsString()
  search?: string;
}

export class RosterLessonsQueryDto implements RosterLessonsQuery {
  @IsOptional()
  @IsIn(LESSON_SORTS)
  sortBy?: RosterLessonSortBy;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDirection?: SortDirection;
}

export class RosterReviewQueryDto implements RosterReviewQuery {
  @IsOptional()
  @IsIn(REVIEW_SORTS)
  sortBy?: RosterReviewSortBy;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDirection?: SortDirection;
}
