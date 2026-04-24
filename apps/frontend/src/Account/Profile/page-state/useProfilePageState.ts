// Orchestrates data and UI state for the Profile page route.
import { useState } from 'react';
import type { StudentProfileResponse, TutorProfileResponse } from '@scholarxp/api-contracts';
import { useAuth } from '@/context/AuthContext';
import { useStudentProfileQuery, useTutorProfileQuery } from '@/Account/Profile/queries/useProfileQueries';

export type StudentModuleSortKey = 'strongest' | 'weakest' | 'recent';

type UseProfilePageStateResult = {
  user: ReturnType<typeof useAuth>['user'];
  isStudent: boolean;
  isTutor: boolean;
  isLoading: boolean;
  studentProfile: StudentProfileResponse | undefined;
  tutorProfile: TutorProfileResponse | undefined;
  moduleSortKey: StudentModuleSortKey;
  setModuleSortKey: (key: StudentModuleSortKey) => void;
  isEditingProfile: boolean;
  setIsEditingProfile: (editing: boolean) => void;
};

export function useProfilePageState(): UseProfilePageStateResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isStudent = user?.globalRole === 'student';
  const isTutor = user?.globalRole === 'teacher';

  const [moduleSortKey, setModuleSortKey] = useState<StudentModuleSortKey>('strongest');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const studentQuery = useStudentProfileQuery(
    !isAuthLoading && isStudent,
    user?.id,
  );

  const tutorQuery = useTutorProfileQuery(
    !isAuthLoading && isTutor,
    user?.id,
  );

  const isLoading = isAuthLoading
    || (isStudent && studentQuery.isPending)
    || (isTutor && tutorQuery.isPending);

  return {
    user,
    isStudent,
    isTutor,
    isLoading,
    studentProfile: studentQuery.data,
    tutorProfile: tutorQuery.data,
    moduleSortKey,
    setModuleSortKey,
    isEditingProfile,
    setIsEditingProfile,
  };
}
