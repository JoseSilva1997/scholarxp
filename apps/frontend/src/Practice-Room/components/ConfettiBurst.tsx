// Renders a burst of confetti particles from the center of its parent container.
// Mount inside a position:relative wrapper; the particles are absolutely positioned and animate outward.
import { useEffect, useState } from 'react';
import styles from '@/Practice-Room/components/ConfettiBurst.module.css';

// Pre-computed particle configs avoid impure render logic. Each particle gets a random-ish direction,
// color, and delay so the burst feels organic without runtime Math.random() in the render path.
const PARTICLE_COUNT = 18;
const COLORS = ['#22c55e', '#10b981', '#34d399', '#fbbf24', '#f59e0b', '#60a5fa', '#a78bfa', '#f472b6'];

type Particle = {
  id: number;
  x: number;
  y: number;
  color: string;
  delay: number;
  size: number;
  rotation: number;
};

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * 360 + (i % 3) * 15;
    const rad = (angle * Math.PI) / 180;
    const distance = 40 + (i % 4) * 20;
    return {
      id: i,
      x: Math.cos(rad) * distance,
      y: Math.sin(rad) * distance,
      color: COLORS[i % COLORS.length],
      delay: (i % 5) * 0.03,
      size: 4 + (i % 3) * 2,
      rotation: angle,
    };
  });
}

const PARTICLES = generateParticles();

export default function ConfettiBurst() {
  const [visible, setVisible] = useState(true);

  // Auto-remove after the animation completes to avoid lingering DOM nodes.
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.container} aria-hidden="true">
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            '--tx': `${p.x}px`,
            '--ty': `${p.y}px`,
            '--rot': `${p.rotation}deg`,
            '--delay': `${p.delay}s`,
            '--size': `${p.size}px`,
            backgroundColor: p.color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
