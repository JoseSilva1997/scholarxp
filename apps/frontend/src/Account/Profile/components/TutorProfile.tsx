// Tutor profile view: teaching overview metrics, module list, activity feed, and profile details.
import { useNavigate } from 'react-router-dom';
import {
  BsRocketTakeoff,
  BsEnvelope,
  BsPersonPlus,
  BsBook,
  BsPeople,
  BsLightning,
  BsClock,
  BsSend,
} from 'react-icons/bs';
import type { TutorProfileResponse, TutorActivityType } from '@scholarxp/api-contracts';
import styles from '@/Account/Profile/components/TutorProfile.module.css';

type TutorProfileProps = {
  profile: TutorProfileResponse;
  isEditing: boolean;
};

// --- Teaching Overview ---

function TeachingOverview({ profile }: { profile: TutorProfileResponse }) {
  const navigate = useNavigate();

  const metrics = [
    { label: 'Modules Created', value: profile.modulesCreated, icon: <BsBook /> },
    { label: 'Live Lessons', value: profile.liveLessonsPublished, icon: <BsRocketTakeoff /> },
    { label: 'Total Students', value: profile.totalEnrolledStudents, icon: <BsPeople /> },
    { label: 'Active (7 Days)', value: profile.studentsActiveLast7Days, icon: <BsLightning /> },
    {
      label: 'Active Invitation Links',
      value: profile.pendingInvites,
      icon: <BsSend />,
      accent: profile.pendingInvites > 0,
    },
  ];

  return (
    <section className={styles.overviewSection}>
      <h2 className={styles.sectionTitle}>Teaching Overview</h2>
      <div className={styles.metricsGrid}>
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`${styles.metricCard} ${m.accent ? styles.metricCardAccent : ''}`}
          >
            <span className={styles.metricIcon}>{m.icon}</span>
            <span className={styles.metricValue}>{m.value}</span>
            <span className={styles.metricLabel}>{m.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.ctaRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => navigate('/main')}
        >
          Create Module
        </button>
        {profile.pendingInvites > 0 ? (
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => navigate('/main')}
          >
            Manage Invites
          </button>
        ) : null}
      </div>
    </section>
  );
}

// --- Your Modules ---

function formatRelativeTime(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoTimestamp).toLocaleDateString();
}

function TutorModules({ profile }: { profile: TutorProfileResponse }) {
  const navigate = useNavigate();

  return (
    <section className={styles.modulesSection}>
      <h2 className={styles.sectionTitle}>Your Modules</h2>
      {profile.modules.length === 0 ? (
        <p className={styles.emptyState}>No modules created yet. Start by creating your first module!</p>
      ) : (
        <div className={styles.moduleList}>
          {profile.modules.map((mod) => (
            <div key={mod.moduleId} className={styles.moduleCard}>
              <div className={styles.moduleCardContent}>
                <h3 className={styles.moduleTitle}>{mod.title}</h3>
                <div className={styles.moduleMeta}>
                  <span className={styles.moduleMetaItem}>
                    <BsPeople aria-hidden="true" /> {mod.studentCount} students
                  </span>
                  <span className={styles.moduleMetaItem}>
                    {mod.liveLessons} live &middot; {mod.draftLessons} draft
                  </span>
                  <span className={styles.moduleMetaTime}>
                    <BsClock aria-hidden="true" /> {formatRelativeTime(mod.lastActivity)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.openButton}
                onClick={() => navigate(`/main/modules/${mod.moduleId}`)}
              >
                Open Module
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- Recent Activity ---

const ACTIVITY_ICONS: Record<TutorActivityType, React.ReactNode> = {
  publish: <BsRocketTakeoff />,
  invite_accepted: <BsEnvelope />,
  enrollment: <BsPersonPlus />,
};

function RecentActivity({ profile }: { profile: TutorProfileResponse }) {
  return (
    <section className={styles.activitySection}>
      <h2 className={styles.sectionTitle}>Recent Teaching Activity</h2>
      {profile.recentActivity.length === 0 ? (
        <p className={styles.emptyState}>
          No recent activity yet. Publish a lesson or invite students to get started!
        </p>
      ) : (
        <div className={styles.activityList}>
          {profile.recentActivity.slice(0, 10).map((item, index) => (
            <div key={`${item.type}-${index}`} className={styles.activityItem}>
              <span className={styles.activityIcon}>{ACTIVITY_ICONS[item.type]}</span>
              <div className={styles.activityContent}>
                <span className={styles.activityDescription}>{item.description}</span>
                <span className={styles.activityTime}>{formatRelativeTime(item.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- Profile Details ---

function ProfileDetails({
  profile,
  isEditing,
}: {
  profile: TutorProfileResponse;
  isEditing: boolean;
}) {
  const details = profile.profile;

  // TODO: Implement editable form with save/cancel when edit mode is active.
  // For now, edit mode shows the same read-only view with a placeholder message.

  const fields = [
    { label: 'Full Name', value: details.name },
    { label: 'Email', value: details.email },
    { label: 'Role', value: details.role },
    { label: 'Bio', value: details.bio, placeholder: 'Add a bio...' },
  ];

  return (
    <section className={styles.detailsSection}>
      <h2 className={styles.sectionTitle}>Profile Details</h2>
      {isEditing ? (
        <p className={styles.editPlaceholder}>
          {/* TODO: Replace with editable form inputs once profile update endpoint exists */}
          Profile editing is coming soon.
        </p>
      ) : null}
      <div className={styles.detailsList}>
        {fields.map((field) => (
          <div key={field.label} className={styles.detailRow}>
            <span className={styles.detailLabel}>{field.label}</span>
            <span className={field.value ? styles.detailValue : styles.detailPlaceholder}>
              {field.value || field.placeholder || '--'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Main Export ---

export default function TutorProfile({ profile, isEditing }: TutorProfileProps) {
  return (
    <div className={styles.tutorProfile}>
      <TeachingOverview profile={profile} />
      <TutorModules profile={profile} />
      <RecentActivity profile={profile} />
      <ProfileDetails profile={profile} isEditing={isEditing} />
    </div>
  );
}
