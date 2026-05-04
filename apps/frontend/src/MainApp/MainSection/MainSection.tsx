// Shared page shell for authed sections; keeps consistent padding and max-width across modules, quests, profile, etc.
import type { ReactNode } from 'react';
import styles from '@/MainApp/MainSection/MainSection.module.css';

type MainSectionProps = {
  children: ReactNode;
  className?: string;
};

export default function MainSection({ children, className }: MainSectionProps) {
  return <section className={`${styles.section} ${className ?? ''}`}>{children}</section>;
}
