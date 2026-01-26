import logo from '../assets/logo.svg';
import './Header.css';

export default function Header() {
  return (
    <header className="sx-header">
      <div className="sx-header__brand">
        <img src={logo} alt="ScholarXP logo" className="sx-header__logo" />
        <span className="sx-header__wordmark">ScholarXP</span>
      </div>

      <nav className="sx-header__nav" aria-label="Primary navigation">
        {/* Navigation links will be added here as pages are introduced. */}
      </nav>

      <div className="sx-header__actions">
        <button className="sx-btn sx-btn--ghost" type="button">
          Login
        </button>
        <button className="sx-btn sx-btn--primary" type="button">
          Register
        </button>
      </div>
    </header>
  );
}
