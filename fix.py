WITH_STRING = """        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.titleSection}>
              {/* Badge placeholder: displays lock when unit is locked, badge when completed */}
              <div className={styles.statusButton}>
                {initialIsCompleted ? (
                  // Completion medal is shown as soon as backend progress marks the unit complete.
                  <img
                    src={completionMedalIcon}
                    alt="Completion medal awarded"
                    className={`${styles.statusIconImage} ${styles.completionMedal}`}
                  />
                ) : isLocked ? (
                  <IoMdLock className={styles.lockedPadlockIcon} aria-hidden="true" />
                ) : null
                }
              </div>
              <div className={styles.meta}>
                <div className={styles.topRow}>
                  <span className={styles.categoryLabel}>Practice</span>
                  <span className={styles.statusTag}>
                    {isLocked ? 'Locked' : (isFullyMastered ? 'Complete' : (initialIsCompleted ? 'Resume' : 'Available'))}
                  </span>
                </div>
                <h3 className={styles.title}>{unit.title}</h3>
                <div className={styles.bottomRow}>
                  {unit.status === 'live' ? (
                     <span className={styles.engagementStat}>
                       <FaCheck className={styles.statIcon} />
                       {completedQuestionsCount}/{unit.questionCount} Questions
                     </span>
                  ) : null}
                  {isLocked && <span className={styles.lockedText}>Unlocks soon...</span>}
                </div>
              </div>
            </div>
            <div className={styles.middleMeta}>"""

OLD_STRING = """        <div className={styles.content}>
          <div className={styles.header}>
            {/* Badge placeholder: displays lock when unit is locked, badge when completed */}
            <div className={styles.statusButton}>
              {initialIsCompleted ? (
                // Completion medal is shown as soon as backend progress marks the unit complete.
                <img
                  src={completionMedalIcon}
                  alt="Completion medal awarded"
                  className={`${styles.statusIconImage} ${styles.completionMedal}`}
                />
              ) : isLocked ? (
                <IoMdLock className={styles.lockedPadlockIcon} aria-hidden="true" />
              ) : null
              }
            </div>
            <div className={styles.meta}>
              <div className={styles.topRow}>
                <span className={styles.categoryLabel}>Practice</span>
                <span className={styles.statusTag}>
                  {isLocked ? 'Locked' : (isFullyMastered ? 'Complete' : (initialIsCompleted ? 'Resume' : 'Available'))}
                </span>
              </div>
              <h3 className={styles.title}>{unit.title}</h3>
              <div className={styles.bottomRow}>
                {unit.status === 'live' ? (
                   <span className={styles.engagementStat}>
                     <FaCheck className={styles.statIcon} />
                     {completedQuestionsCount}/{unit.questionCount} Questions
                   </span>
                ) : null}
                {isLocked && <span className={styles.lockedText}>Unlocks soon...</span>}
              </div>
            </div>
            <div className={styles.middleMeta}>"""

import os
with open('apps/frontend/src/components/StudentModuleUnitCard.tsx', 'r') as f:
    content = f.read()

content = content.replace(OLD_STRING, WITH_STRING)
with open('apps/frontend/src/components/StudentModuleUnitCard.tsx', 'w') as f:
    f.write(content)

print("Done")
