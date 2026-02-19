/**
 * AuthVisual.tsx
 * Shared visual component for login/register pages with branding and animations.
 */

import React from 'react';
import logo from '../assets/logo.svg';
import styles from './AuthVisual.module.css';

/**
 * Animated background panel for the authentication pages.
 * Displays logo, wordmark, tagline, and animated floating shapes.
 */
export const AuthVisual: React.FC = () => {
  return (
    <section className={styles.visual} aria-hidden="true" role="presentation">
      <div className={styles.backgroundItems}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
      </div>

      <div className={styles.content}>
        <header className={styles.logoWrapper}>
          <img src={logo} alt="" className={styles.logo} />
          <h1 className={styles.wordmark}>ScholarXP</h1>
        </header>

        <p className={styles.tagline}>Master your courses with consistent practice and rewarding challenges.</p>

        <ul className={styles.stats}>
          <li className={styles.statLine}>
            <span className={styles.statIcon} aria-hidden="true">⚡</span>
            <span>Mastery through consistency</span>
          </li>
          <li className={styles.statLine}>
            <span className={styles.statIcon} aria-hidden="true">🧠</span>
            <span>Adaptive learning paths</span>
          </li>
          <li className={styles.statLine}>
            <span className={styles.statIcon} aria-hidden="true">💎</span>
            <span>Gamified learning experience</span>
          </li>
        </ul>
      </div>

      <div className={styles.floatingShapes}>
        <div className={styles.shape} style={{ '--delay': '0s', '--left': '8%', '--top': '15%' } as React.CSSProperties}>✨</div>
        <div className={styles.shape} style={{ '--delay': '3s', '--left': '85%', '--top': '25%' } as React.CSSProperties}>📚</div>
        <div className={styles.shape} style={{ '--delay': '5s', '--left': '12%', '--top': '75%' } as React.CSSProperties}>🎯</div>
        <div className={styles.shape} style={{ '--delay': '2s', '--left': '78%', '--top': '82%' } as React.CSSProperties}>🧪</div>
        <div className={styles.shape} style={{ '--delay': '4s', '--left': '45%', '--top': '10%' } as React.CSSProperties}>🎓</div>
        <div className={styles.shape} style={{ '--delay': '1s', '--left': '55%', '--top': '85%' } as React.CSSProperties}>⭐</div>
      </div>
    </section>
  );
};
