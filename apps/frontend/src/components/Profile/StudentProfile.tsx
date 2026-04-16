// Composes student profile sections so each area can evolve independently without turning the page into a monolith.
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import type { StudentModuleSortKey } from '../../hooks/page-state/useProfilePageState';
import {
  AchievementsSection,
  CosmeticsSection,
  ModulesSection,
  OverviewSection,
  StatsSection,
} from './StudentProfile/index';
import styles from './StudentProfile.module.css';

type StudentProfileProps = {
  profile: StudentProfileResponse;
  moduleSortKey: StudentModuleSortKey;
  onModuleSortChange: (key: StudentModuleSortKey) => void;
};

export default function StudentProfile({
  profile,
  moduleSortKey,
  onModuleSortChange,
}: StudentProfileProps) {
  return (
    <div className={styles.studentProfile}>
      <OverviewSection profile={profile} />
      <ModulesSection
        modules={profile.modules}
        sortKey={moduleSortKey}
        onSortChange={onModuleSortChange}
      />
      <AchievementsSection profile={profile} />
      <CosmeticsSection />
      <StatsSection profile={profile} />
    </div>
  );
}
