import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react'; // Alternative logo icon

export const Navbar = () => {
  return (
    <nav className="landing-navbar">
      <Link to="/" className="landing-brand">
        <Shield size={32} color="var(--accent)" fill="var(--accent-glow)" />
        <span className="landing-brand-text">MISIL</span>
      </Link>

      <div className="landing-nav-links">
        <a href="#features" className="landing-nav-link">Características</a>
        <a href="#compare" className="landing-nav-link">¿Por qué Misil?</a>
        <Link to="/downloader" className="landing-nav-link">Misil Downloader</Link>
      </div>

      <div className="landing-nav-actions">
        <Link to="/login" className="btn btn-secondary">Iniciar sesión</Link>
        <Link to="/login" className="btn btn-primary" style={{ background: 'var(--accent)', color: 'white' }}>Registrarse</Link>
      </div>
    </nav>
  );
};
