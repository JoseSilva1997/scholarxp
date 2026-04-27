// Profile domain contracts: aggregated views for student and tutor profile pages.
import type { AccountProgress } from '../auth';
import type { DailyLessonXpTrackResponse } from '../rewards/daily-lesson-xp-track';

// --- Student Profile ---

export type DailyPracticeProfileStatus = 'done' | 'available' | 'not_available';

export interface StudentProfileModule {
  moduleId: number;
  title: string;
  proficiencyLevel: number;
  moduleXP: number;
  moduleXPMax: number;
  completedLessons: number;
  totalLessons: number;
  dailyPracticeStatus: DailyPracticeProfileStatus;
}

export interface QuestHistorySummary {
  totalCompleted: number;
  perfectDays: number;
}

export interface StudentProfileResponse {
  accountLevel: number;
  totalAccountXP: number;
  xpToNextLevel: number;
  accountProgress: AccountProgress;
  masterQuestStreak: number;
  todayQuestProgress: { completed: number; total: number };
  dailyLessonXPTrack: DailyLessonXpTrackResponse | null;
  modules: StudentProfileModule[];
  questHistorySummary: QuestHistorySummary;
}

// --- Tutor Profile ---

export interface TutorProfileModule {
  moduleId: number;
  title: string;
  studentCount: number;
  liveLessons: number;
  draftLessons: number;
  lastActivity: string;
}

export type TutorActivityType = 'publish' | 'invite_accepted' | 'enrollment';

export interface TutorActivityItem {
  type: TutorActivityType;
  description: string;
  timestamp: string;
}

export interface TutorProfileDetails {
  name: string;
  email: string | null;
  role: string;
  bio: string | null;
}

export interface TutorProfileResponse {
  modulesCreated: number;
  liveLessonsPublished: number;
  totalEnrolledStudents: number;
  studentsActiveLast7Days: number;
  pendingInvites: number;
  modules: TutorProfileModule[];
  recentActivity: TutorActivityItem[];
  profile: TutorProfileDetails;
}
