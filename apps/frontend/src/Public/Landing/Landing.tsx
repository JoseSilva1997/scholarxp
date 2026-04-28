// The public marketing landing page - renders at '/' for unauthenticated users via App.tsx.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  RiBrainLine,
  RiCalendarCheckLine,
  RiShuffleLine,
  RiFireLine,
  RiStarLine,
  RiBookOpenLine,
  RiGraduationCapLine,
  RiArrowRightLine,
  RiCheckLine,
  RiGroupLine,
  RiLineChartLine,
  RiBuilding2Line,
} from 'react-icons/ri';
import styles from '@/Public/Landing/Landing.module.css';

// Triggers a CSS reveal animation when the element scrolls into view.
// Disconnect after the first intersection - we only animate in once.
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute('data-revealed', '');
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

const tutorSteps = [
  { icon: <RiBookOpenLine />, label: 'Create a module and build structured lessons with exercises' },
  { icon: <RiShuffleLine />, label: 'Optionaly add question variants to prevent students memorising answer patterns' },
  { icon: <RiGroupLine />, label: 'Invite students and manage your roster' },
  { icon: <RiLineChartLine />, label: 'Monitor progress and performance from your tutor dashboard' },
];

const studentSteps = [
  { icon: <RiGraduationCapLine />, label: 'Enrol in your tutor\'s module and work through the lessons' },
  { icon: <RiCalendarCheckLine />, label: 'Each day receive a short personalised set of 3–10 questions' },
  { icon: <RiStarLine />, label: 'Watch your proficiency grow as spaced repetition strengthens memory' },
  { icon: <RiFireLine />, label: 'Complete daily quests, build your streak, and earn bonus XP' },
];

const features = [
  {
    icon: <RiBrainLine />,
    title: 'Spaced repetition that adapts to you',
    body: 'The FSRS algorithm schedules each question at exactly the right moment - before you forget, not after. Memory improves with every session.',
    color: 'primary',
  },
  {
    icon: <RiCalendarCheckLine />,
    title: 'Daily sets sized to real review pressure',
    body: '3–10 questions per module per day. Light days are intentionally light. The system respects your schedule and keeps practice sustainable.',
    color: 'secondary',
  },
  {
    icon: <RiShuffleLine />,
    title: 'Variants that prevent pattern matching',
    body: 'Each question can have multiple phrasings. Students answer the underlying concept - not a memorised option order from last week.',
    color: 'accent',
  },
  {
    icon: <RiFireLine />,
    title: 'Quests and streaks that reward consistency',
    body: 'Daily quests incentivise showing up. A streak multiplier awards up to +50% bonus XP for students who return every day. Cramming can\'t replicate this.',
    color: 'primary',
  },
  {
    icon: <RiStarLine />,
    title: 'Two XP tracks: proficiency and progression',
    body: 'Module-scoped proficiency XP reflects how well a student knows a subject. Global account XP tracks overall progress and unlocks rewards.',
    color: 'secondary',
  },
];

export default function Landing() {
  const howRef = useReveal();
  const featuresRef = useReveal();
  const philosophyRef = useReveal();
  const fitRef = useReveal();
  const ctaRef = useReveal();

  return (
    <div className={styles.page}>
      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>Study companion · Works alongside your curriculum</p>
            <h1 className={styles.heroTitle}>
              Practice a little every day.
              <br />
              Remember a lot more.
            </h1>
            <p className={styles.heroSubtitle}>
              ScholarXP uses spaced repetition and daily quests to build genuine long-term memory - not last-minute
              cramming. Tutors build the content. Students build the habit. Sits alongside your curriculum.
            </p>
            <div className={styles.heroCtas}>
              <Link to="/register" className={styles.ctaPrimary}>
                Get started free <RiArrowRightLine />
              </Link>
              <a href="#how-it-works" className={styles.ctaGhost}>
                See how it works
              </a>
            </div>
            <div className={styles.heroPills}>
              <span className={styles.pill}>3–10 questions a day</span>
              <span className={styles.pill}>FSRS spaced repetition</span>
              <span className={styles.pill}>Daily quests &amp; streaks</span>
            </div>
          </div>
          <div className={styles.heroVisual} aria-hidden="true">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section id="how-it-works" className={styles.howSection}>
        <div className={styles.sectionInner} ref={howRef}>
          <p className={styles.sectionLabel}>How it works</p>
          <h2 className={styles.sectionTitle}>Built for two audiences, working in sync</h2>
          <div className={styles.howGrid}>
            <div className={styles.howColumn}>
              <div className={styles.howColumnHeader}>
                <div className={`${styles.howIcon} ${styles.howIconTutor}`}>
                  <RiBookOpenLine />
                </div>
                <h3 className={styles.howColumnTitle}>For tutors</h3>
              </div>
              <ol className={styles.howSteps}>
                {tutorSteps.map((step, i) => (
                  <li key={i} className={styles.howStep}>
                    <span className={styles.howStepIcon}>{step.icon}</span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.howDivider} />
            <div className={styles.howColumn}>
              <div className={styles.howColumnHeader}>
                <div className={`${styles.howIcon} ${styles.howIconStudent}`}>
                  <RiGraduationCapLine />
                </div>
                <h3 className={styles.howColumnTitle}>For students</h3>
              </div>
              <ol className={styles.howSteps}>
                {studentSteps.map((step, i) => (
                  <li key={i} className={styles.howStep}>
                    <span className={styles.howStepIcon}>{step.icon}</span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ───────────────────────────────────────── */}
      <section className={styles.featuresSection}>
        <div className={styles.sectionInner} ref={featuresRef}>
          <p className={styles.sectionLabel}>Core features</p>
          <h2 className={styles.sectionTitle}>Everything that makes it stick</h2>
          <div className={styles.featuresGrid}>
            {features.map((f) => (
              <article key={f.title} className={`${styles.featureCard} ${styles[`featureCard--${f.color}` as keyof typeof styles]}`}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureBody}>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PHILOSOPHY ──────────────────────────────────────────── */}
      <section className={styles.philosophySection}>
        <div className={styles.sectionInner} ref={philosophyRef}>
          <p className={`${styles.sectionLabel} ${styles.sectionLabelLight}`}>The philosophy</p>
          <h2 className={styles.philosophyTitle}>Cramming feels productive, but isn&apos;t.</h2>
          <p className={styles.philosophyBody}>
            ScholarXP is a companion to formal teaching - not a replacement. Students keep what they learn in class
            instead of forgetting it before the next lesson, and tutors get a structured way to reinforce their own curriculum.
          </p>
          <p className={styles.philosophyBody}>
            Memory research is clear: spreading practice over time beats massing it into one session. ScholarXP is built
            around this. The daily cap isn&apos;t a limitation - it&apos;s the mechanism. Someone who practices 10 minutes
            every day for a week retains far more than someone who spends an hour the night before.
          </p>
          <p className={styles.philosophyBody}>
            The reward structure reinforces it. You can&apos;t earn a streak bonus by grinding. You can&apos;t complete a
            week&apos;s worth of quests in one sitting. The XP system makes the daily habit itself the highest-value action.
          </p>
          <div className={styles.philosophyStats}>
            <div className={styles.philosophyStat}>
              <span className={styles.philosophyStatNumber}>1 set</span>
              <span className={styles.philosophyStatLabel}>one focused practice session per day, per module - no grind required</span>
            </div>
            <div className={styles.philosophyStat}>
              <span className={styles.philosophyStatNumber}>3–10</span>
              <span className={styles.philosophyStatLabel}>questions per day - sized to keep practice sustainable</span>
            </div>
            <div className={styles.philosophyStat}>
              <span className={styles.philosophyStatNumber}>+50%</span>
              <span className={styles.philosophyStatLabel}>XP streak bonus for students who return every single day</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FIT BAND (SOCIAL PROOF REPLACEMENT) ──────────────────── */}
      {/* Positions ScholarXP as a curriculum supplement, not a replacement - reassurance for institutional buyers. */}
      <section className={styles.fitBand} ref={fitRef}>
        <div className={styles.fitBandInner}>
          <div className={styles.fitBandCard}>
            <div className={styles.fitBandIcons} aria-hidden="true">
              <span className={`${styles.fitBandIcon} ${styles.fitBandIconClass}`}>
                <RiBuilding2Line />
              </span>
              <span className={styles.fitBandPlus}>+</span>
              <span className={`${styles.fitBandIcon} ${styles.fitBandIconTutor}`}>
                <RiBookOpenLine />
              </span>
            </div>
            <p className={styles.fitBandEyebrow}>For schools, tutors &amp; institutions</p>
            <h2 className={styles.fitBandTitle}>A companion to your curriculum</h2>
            <p className={styles.fitBandSubtext}>
              Built to support classrooms and tutors. Reinforcing classroom lessons, never replacing them.
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.sectionInner} ref={ctaRef}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Ready to make practice a habit?</h2>
            <p className={styles.ctaSubtitle}>
              Join tutors who&apos;ve replaced cramming with consistent, effective daily practice - and students who
              actually retain what they learn.
            </p>
            <div className={styles.ctaButtons}>
              <Link to="/register" className={styles.ctaPrimaryDark}>
                Sign up free <RiArrowRightLine />
              </Link>
              <Link to="/login" className={styles.ctaGhostDark}>
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className={styles.mockup}>
      <div className={styles.mockupCard}>
        <div className={styles.mockupCardTop}>
          <span className={styles.mockupModule}>Biology · A-Level</span>
          <span className={styles.mockupQuestBadge}>
            <RiFireLine aria-hidden="true" /> Quest active
          </span>
        </div>
        <p className={styles.mockupHeading}>Today&apos;s Practice</p>
        <div className={styles.mockupDots} role="presentation">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`${styles.mockupDot} ${i < 2 ? styles.mockupDotDone : i === 2 ? styles.mockupDotActive : ''}`}
            />
          ))}
        </div>
        <div className={styles.mockupXpRow}>
          <span className={styles.mockupXpLabel}>1,240 XP</span>
          <span className={styles.mockupLevel}>Level 8</span>
        </div>
        <div className={styles.mockupXpTrack}>
          <div className={styles.mockupXpFill} />
        </div>
        <div className={styles.mockupBtn} aria-hidden="true">
          Start practice
        </div>
      </div>
      <div className={`${styles.mockupFloat} ${styles.mockupFloatStreak}`} aria-hidden="true">
        <RiFireLine /> 7-day streak
      </div>
      <div className={`${styles.mockupFloat} ${styles.mockupFloatXp}`} aria-hidden="true">
        <RiCheckLine /> +50 XP earned
      </div>
      <div className={`${styles.mockupFloat} ${styles.mockupFloatQuest}`} aria-hidden="true">
        <RiStarLine /> Quest complete!
      </div>
    </div>
  );
}
