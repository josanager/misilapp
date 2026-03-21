import { Link } from 'react-router-dom';

export const Navbar = () => {
  return (
    <nav className="landing-navbar">
      <Link to="/" className="landing-brand">
        <img src="/favicon.svg" alt="Misil logo" style={{ width: 28, height: 28 }} />
        <span className="landing-brand-text">MISIL</span>
      </Link>

      <div className="landing-nav-links">
        <Link to="#features" className="landing-nav-link">Características</Link>
        <Link to="#compare" className="landing-nav-link">¿Por qué Misil?</Link>
        <Link to="/downloader" className="landing-nav-link">Misil Downloader</Link>
      </div>

      <div className="landing-nav-actions">
        <Link to="/login" className="btn btn-secondary">Iniciar sesión</Link>
        <Link to="/login" className="btn btn-primary" style={{ background: 'var(--accent)', color: 'white' }}>Registrarse</Link>
      </div>
    </nav>
  );
};
