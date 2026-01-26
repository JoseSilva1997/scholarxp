import styles from './Landing.module.css';

const highlights = [
  {
    title: 'Daily bite-sized practice',
    body: 'Launch a focused 5-minute set directly from your LMS without setup friction.',
  },
  {
    title: 'XP without the grind',
    body: 'Light gamification that rewards consistency over streak anxiety or endless grinding.',
  },
  {
    title: 'LTI-native by design',
    body: 'Secure, LMS-friendly launch that keeps student data where it belongs.',
  },
];

export default function Landing() {
  return (
    <div className={styles.landing}>
      <section className={styles.hero}>
        <p className={styles.heroEyebrow}>ScholarXP · Study companion</p>
        <h1 className={styles.heroTitle}>Keep students practicing—without piling on more work.</h1>
        <p className={styles.heroSubtitle}>
          ScholarXP launches from your LMS and guides learners through short, repeatable sessions that build
          confidence daily.
        </p>

        <div className={styles.heroBadges} aria-label="Key benefits">
          <span className={styles.pill}>5–8 minute practice bursts</span>
          <span className={styles.pill}>Built for daily cadence</span>
          <span className={styles.pill}>Ready for LTI 1.3</span>
        </div>
      </section>

      <section className={styles.featureGrid} aria-label="What makes ScholarXP different">
        {highlights.map((item) => (
          <article key={item.title} className={styles.featureCard}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
