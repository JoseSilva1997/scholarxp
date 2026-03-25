// Profile page shell: reads current user role and renders the appropriate profile view.
import MainSection from '../../components/MainSection';
import HeroCard from '../../components/Profile/HeroCard';
import StudentProfile from '../../components/Profile/StudentProfile';
import TutorProfile from '../../components/Profile/TutorProfile';
import { useProfilePageState } from '../../hooks/page-state/useProfilePageState';

export default function ProfilePage() {
  const {
    user,
    isStudent,
    isTutor,
    isLoading,
    studentProfile,
    tutorProfile,
    moduleSortKey,
    setModuleSortKey,
    isEditingProfile,
    setIsEditingProfile,
  } = useProfilePageState();

  if (isLoading || !user) {
    return (
      <MainSection>
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
          Loading profile...
        </div>
      </MainSection>
    );
  }

  return (
    <MainSection>
      <HeroCard
        user={user}
        accountProgress={isStudent ? (studentProfile?.accountProgress ?? user.avatar) : null}
        masterQuestStreak={isStudent ? studentProfile?.masterQuestStreak : undefined}
        isEditingProfile={isEditingProfile}
        onEditProfile={() => setIsEditingProfile(!isEditingProfile)}
      />

      {isStudent && studentProfile ? (
        <StudentProfile
          profile={studentProfile}
          moduleSortKey={moduleSortKey}
          onModuleSortChange={setModuleSortKey}
        />
      ) : null}

      {isTutor && tutorProfile ? (
        <TutorProfile
          profile={tutorProfile}
          isEditing={isEditingProfile}
        />
      ) : null}
    </MainSection>
  );
}
