import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={`landing-navbar ${menuOpen ? 'menu-open' : ''}`}>
      <Link to="/" className="landing-brand">
        <img src="/favicon.svg" alt="Misil logo" style={{ width: 28, height: 28 }} />
        <span className="landing-brand-text">MISIL</span>
      </Link>

      <div className={`landing-nav-actions ${menuOpen ? 'mobile-visible' : ''}`}>
        <Link to="/downloader" className="landing-nav-link" style={{ fontWeight: 'bold' }} onClick={() => setMenuOpen(false)}>Misil Downloader</Link>
        <Link to="/login" className="btn btn-secondary" onClick={() => setMenuOpen(false)}>Iniciar sesión</Link>
        <Link to="/login" className="btn btn-primary" style={{ background: 'var(--accent)', color: 'white' }} onClick={() => setMenuOpen(false)}>Registrarse</Link>
      </div>

      <button className="mobile-menu-toggle" style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={28} /> : <Menu size={28} />}
      </button>
    </nav>
  );
};
