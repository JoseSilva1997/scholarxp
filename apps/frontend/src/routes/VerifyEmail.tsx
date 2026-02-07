import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resendVerification, verifyEmail } from '../api/auth';
import { getDisplayErrorMessage } from '../api/get-display-error';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

// Simple verification card that matches the login/register layout; shown after signup or blocked login.
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';
  const initialMessage = (location.state as { message?: string } | null)?.message ?? null;

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(initialMessage);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const { user } = await verifyEmail(code.trim());
      if (user) {
        setUser(user);
        navigate('/main', { replace: true });
        return;
      }
      setError('Invalid or expired code.');
    } catch (err) {
      setError(
        getDisplayErrorMessage(err, {
          fallbackMessage: 'Unable to verify right now.',
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError('Enter your email to resend a code.');
      return;
    }
    setError(null);
    setInfo(null);
    setCooldown(30);
    try {
      const result = await resendVerification(email.trim().toLowerCase());
      if ('alreadyVerified' in result && result.alreadyVerified) {
        setInfo('Already verified—try logging in.');
        return;
      }
      setInfo('New code sent. Check your inbox.');
    } catch (err) {
      setError(
        getDisplayErrorMessage(err, {
          fallbackMessage: 'Unable to resend right now.',
        }),
      );
      setCooldown(0);
    }
  }

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <section className={styles.visual} aria-hidden="true" />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Verify your email</h1>
            <p className={styles.subtitle}>
              Enter the code we sent to {email ? <strong>{email}</strong> : 'your email address'} to finish
              signing in.
            </p>

            <form className={styles.form} onSubmit={handleVerify}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="code">Verification code</label>
                <input
                  className={styles.input}
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={8}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input
                  className={styles.input}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error ? <div className={styles.error}>{error}</div> : null}
              {info ? <div className={styles.helperCard}>{info}</div> : null}

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={isSubmitting || code.trim().length < 4}>
                  {isSubmitting ? 'Verifying…' : 'Verify and continue'}
                </button>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>

            <div className={styles.helper}>
              <p className={styles.inlineHelper}>
                Already verified?{' '}
                <Link className={styles.helperLink} to="/login">
                  Log in
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
