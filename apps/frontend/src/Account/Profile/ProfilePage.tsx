// Profile page shell: reads current user role and renders the appropriate profile view.
import { canAccess, features } from '@scholarxp/permissions';
import MainSection from '@/MainApp/MainSection/MainSection';
import HeroCard from '@/Account/Profile/components/HeroCard';
import StudentProfile from '@/Account/Profile/components/StudentProfile';
import TutorProfile from '@/Account/Profile/components/TutorProfile';
import DeleteAccountSection from '@/Account/Profile/components/DeleteAccountSection';
import { useProfilePageState } from '@/Account/Profile/page-state/useProfilePageState';

// Composes the Account page by delegating role-specific presentation to student and tutor sections.
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
        // Students have XP progress from the profile aggregate; other roles intentionally omit the ring.
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

      {canAccess(features.users.deleteOwnAccount, { role: user.globalRole }) ? (
        <DeleteAccountSection user={user} />
      ) : null}
    </MainSection>
  );
}
