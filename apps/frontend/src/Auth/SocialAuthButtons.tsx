// Renders OAuth entry points so sign-in/up can delegate to external providers (Google).
// Uses hosted brand assets to avoid bundling duplicates while matching official logos.
import styles from '@/Auth/SocialAuthButtons.module.css';

type Provider = 'google';

type SocialAuthButtonsProps = {
  context: 'login' | 'register';
};

const PROVIDERS: { key: Provider; label: string; icon: string }[] = [
  {
    key: 'google',
    label: 'Sign in with Google',
    icon: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
  },
];

// Identifies Auth entry routes that should not become OAuth return targets.
function isAuthRoute(pathname: string) {
  return pathname === '/login' || pathname === '/register' || pathname === '/verify-email';
}

// Renders configured OAuth providers and initiates provider-specific redirects.
export function SocialAuthButtons({ context }: SocialAuthButtonsProps) {
  const apiBase = import.meta.env.VITE_API_URL;
  const disabled = !apiBase;

  // Builds an OAuth URL that preserves the intended post-auth route across a full-page provider round-trip.
  const handleRedirect = (provider: Provider) => {
    if (!apiBase) return;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const fallbackRedirect = isAuthRoute(window.location.pathname) ? '/main' : currentPath;
    // Persist the intended post-auth path so the backend can restore it after OAuth round-trips.
    // Auth entry routes should never be the fallback target because they cause a visible bounce after OAuth.
    const pendingRedirect =
      sessionStorage.getItem('postAuthRedirect') ?? fallbackRedirect;
    const redirectParam = encodeURIComponent(pendingRedirect);
    // Use full-page redirect so OAuth flow can set cookies on the API domain.
    const target = `${apiBase}/auth/oauth/${provider}?intent=${context}&redirect=${redirectParam}`;
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
