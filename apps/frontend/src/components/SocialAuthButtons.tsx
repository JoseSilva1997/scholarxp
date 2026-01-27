// Renders OAuth entry points so sign-in/up can delegate to external providers (Google, Microsoft, etc.).
// Uses hosted brand assets to avoid bundling duplicates while matching official logos.
import styles from './SocialAuthButtons.module.css';

type Provider = 'google' | 'microsoft';

type SocialAuthButtonsProps = {
  context: 'login' | 'register';
};

const PROVIDERS: { key: Provider; label: string; icon: string }[] = [
  {
    key: 'google',
    label: 'Sign in with Google',
    icon: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
  },
  {
    key: 'microsoft',
    label: 'Sign in with Microsoft',
    icon: 'https://learn.microsoft.com/en-us/entra/identity-platform/media/howto-add-branding-in-apps/ms-symbollockup_mssymbol_19.svg',
  },
];

export function SocialAuthButtons({ context }: SocialAuthButtonsProps) {
  const apiBase = import.meta.env.VITE_API_URL;
  const disabled = !apiBase;

  const handleRedirect = (provider: Provider) => {
    if (!apiBase) return;
    // Use full-page redirect so OAuth flow can set cookies on the API domain.
    const target = `${apiBase}/auth/oauth/${provider}?intent=${context}`;
    window.location.assign(target);
  };

  return (
    <div className={styles.section} aria-label="Sign in with a provider">
      <div className={styles.divider}>
        <span>or</span>
      </div>
      <div className={styles.buttons}>
        {PROVIDERS.map((provider) => (
          <button
            key={provider.key}
            type="button"
            className={styles.oauthBtn}
            onClick={() => handleRedirect(provider.key)}
            disabled={disabled}
          >
            <span className={styles.icon} aria-hidden="true">
              <img src={provider.icon} alt="" loading="lazy" />
            </span>
            <span>{provider.label}</span>
          </button>
        ))}
      </div>
      {disabled ? (
        <p className={styles.helper}>Set VITE_API_URL to enable OAuth sign-in.</p>
      ) : null}
    </div>
  );
}
