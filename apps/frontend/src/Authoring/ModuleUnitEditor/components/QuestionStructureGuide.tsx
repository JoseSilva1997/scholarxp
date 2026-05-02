// Popover guide that explains the module unit editor's structural concepts (groups, questions, variants) to content authors.
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo, FiFolder, FiFileText, FiShuffle, FiRadio } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import styles from '@/Authoring/ModuleUnitEditor/components/QuestionStructureGuide.module.css';

type Tab = 'groups' | 'questions' | 'variants' | 'live';

const TABS: Tab[] = ['groups', 'questions', 'variants', 'live'];

interface TabConfig {
  label: string;
  icon: IconType;
  heading: string;
  body: string;
  colorClass: string;
  badgeClass: string;
}

const TAB_CONFIG: Record<Tab, TabConfig> = {
  groups: {
    label: 'Groups',
    icon: FiFolder,
    colorClass: styles.colorBlue,
    badgeClass: styles.badgeBlue,
    heading: 'Groups',
    body: 'Groups organise questions into logical sections - for example by topic or difficulty. You can rename, collapse, or delete groups. They are an organisational tool only and do not affect practice',
  },
  questions: {
    label: 'Core Questions',
    icon: FiFileText,
    colorClass: styles.colorGreen,
    badgeClass: styles.badgeGreen,
    heading: 'Core Questions',
    body: 'Each core question is a practice item. During regular sessions students only see the core question. Keep each question focused on a single, testable idea.',
  },
  variants: {
    label: 'Variants',
    icon: FiShuffle,
    colorClass: styles.colorAmber,
    badgeClass: styles.badgeAmber,
    heading: 'Variants',
    body: 'Variants are alternative versions of the same question. The algorithm rotates them in daily practice over time to reduce the chance a student answers correctly from memorising the core question option rather than understanding the concept. Variants should test the same knowledge differently - if none are added, the core question is reused.',
  },
  live: {
    label: 'Live',
    icon: FiRadio,
    colorClass: styles.colorRed,
    badgeClass: styles.badgeRed,
    heading: 'Live Lessons',
    body: 'Once a lesson goes live and students can practise it, questions and variants can no longer be added — this protects the integrity of the algorithm and each student\'s progress history. You can still delete questions and variants, and edit their content, but be mindful that significantly changing a question after students have already practised it can affect their results negatively.',
  },
};

// Renders an explanatory popover for the editor's group/question/variant structure.
export default function QuestionStructureGuide() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position the portal-rendered popover below the trigger on open.
  // Portal is required because the trigger sits inside an overflow:hidden panel.
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  // Close on any click outside both the trigger and the popover.
  useEffect(() => {
    if (!open) return;
    // Detects outside clicks across both the trigger and portal-rendered popover.
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const outsideTrigger = !triggerRef.current?.contains(target);
      const outsidePopover = !popoverRef.current?.contains(target);
      if (outsideTrigger && outsidePopover) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const config = TAB_CONFIG[activeTab];
  const Icon = config.icon;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.triggerButton} ${open ? styles.triggerButtonActive : ''}`}
        aria-label="About the question structure"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FiInfo aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            style={popoverStyle}
            role="dialog"
            aria-label="Question structure guide"
          >
            <div className={styles.tabs} role="tablist">
              {TABS.map((tab) => {
                const TabIcon = TAB_CONFIG[tab].icon;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.tab} ${isActive ? `${styles.tabActive} ${TAB_CONFIG[tab].colorClass}` : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    <TabIcon className={styles.tabIcon} aria-hidden />
                    {TAB_CONFIG[tab].label}
                  </button>
                );
              })}
            </div>
            <div className={styles.body}>
              <div className={`${styles.iconBadge} ${config.colorClass} ${config.badgeClass}`}>
                <Icon aria-hidden />
              </div>
              <div className={styles.bodyText}>
                <strong className={`${styles.heading} ${config.colorClass}`}>{config.heading}</strong>
                <p className={styles.text}>{config.body}</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
