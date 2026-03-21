import { Link } from 'react-router-dom';
import { Shield, Lock, Users, ImageIcon, Zap, EyeOff, XCircle, CheckCircle } from 'lucide-react';
import { Navbar } from './Navbar';
import './LandingPage.css';

export const LandingPage = () => {
  return (
    <div className="landing-page">
      <Navbar />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg" />
        <div className="hero-content">
          <h1 className="hero-title">
            La mensajería sin censura.<br />
            Sin límites. Sin excusas.
          </h1>
          <p className="hero-subtitle">
            Misil es la plataforma donde tú decides qué compartir. Sin moderación arbitraria, sin borrado de contenido, sin restricciones de grupos. Tu privacidad, tus reglas.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary" style={{ background: 'var(--accent)', padding: '16px 32px', fontSize: '18px', borderRadius: '100px' }}>
              Empezar gratis
            </Link>
            <Link to="#how-it-works" className="btn btn-secondary" style={{ padding: '16px 32px', fontSize: '18px', borderRadius: '100px' }}>
              Ver cómo funciona
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="mockup-container">
            <div className="mockup-header">
              <div className="mockup-avatar" />
              <div className="mockup-title" />
            </div>
            <div className="mockup-body">
              <div className="mockup-msg other">
                <div className="mockup-line" style={{ width: '80%' }} />
                <div className="mockup-line" style={{ width: '60%' }} />
              </div>
              <div className="mockup-msg own">
                <div className="mockup-line" style={{ width: '100%' }} />
                <div className="mockup-line" style={{ width: '90%' }} />
                <div className="mockup-line" style={{ width: '40%' }} />
              </div>
              <div className="mockup-msg other">
                <div className="mockup-line" style={{ width: '50%' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compare Section */}
      <section id="compare" className="section" style={{ background: 'var(--bg-tertiary)' }}>
        <h2 className="section-title">WhatsApp, Telegram, Discord... te controlan.</h2>

        <div className="competitors-grid">
          <div className="competitor-card">
            <div className="competitor-header">
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>WA</div>
              <div className="competitor-name">WhatsApp</div>
            </div>
            <ul className="competitor-list">
              <li><XCircle className="competitor-icon" size={20} /> Borra grupos sin aviso</li>
              <li><XCircle className="competitor-icon" size={20} /> Comparte tus datos con Meta</li>
              <li><XCircle className="competitor-icon" size={20} /> Limita el tamaño de archivos</li>
            </ul>
          </div>

          <div className="competitor-card">
            <div className="competitor-header">
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>TG</div>
              <div className="competitor-name">Telegram</div>
            </div>
            <ul className="competitor-list">
              <li><XCircle className="competitor-icon" size={20} /> Elimina canales por "contenido"</li>
              <li><XCircle className="competitor-icon" size={20} /> Monitorea mensajes públicos</li>
              <li><XCircle className="competitor-icon" size={20} /> Cede datos a gobiernos</li>
            </ul>
          </div>

          <div className="competitor-card">
            <div className="competitor-header">
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>DC</div>
              <div className="competitor-name">Discord</div>
            </div>
            <ul className="competitor-list">
              <li><XCircle className="competitor-icon" size={20} /> Banea servidores permanentemente</li>
              <li><XCircle className="competitor-icon" size={20} /> Modera contenido activamente</li>
              <li><XCircle className="competitor-icon" size={20} /> Requiere verificación</li>
            </ul>
          </div>
        </div>

        <div className="contrast-banner">
          <CheckCircle size={48} color="var(--accent-green)" style={{ margin: '0 auto 16px' }} />
          <h3>Misil no borra nada.</h3>
          <p>Tú eres el dueño de tus conversaciones y archivos.</p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section">
        <h2 className="section-title">Construido para la libertad</h2>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Shield size={24} />
            </div>
            <h3 className="feature-title">Sin censura</h3>
            <p className="feature-desc">Sube lo que quieras. Nadie revisa, nadie borra. Tus conversaciones están a salvo de la moderación.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Lock size={24} />
            </div>
            <h3 className="feature-title">Cifrado de mensajes</h3>
            <p className="feature-desc">Tus conversaciones son tuyas con TweetNaCl E2E. Seguridad de grado militar por defecto.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Users size={24} />
            </div>
            <h3 className="feature-title">Grupos y temas</h3>
            <p className="feature-desc">Organiza conversaciones en grupos con múltiples topics para mantener el orden sin perder la libertad.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <ImageIcon size={24} />
            </div>
            <h3 className="feature-title">Multimedia sin límites</h3>
            <p className="feature-desc">Imágenes, vídeos, archivos pesados. Sube todo sin las restricciones absurdas de otras apps.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Zap size={24} />
            </div>
            <h3 className="feature-title">Velocidad real</h3>
            <p className="feature-desc">Tiempo real con Supabase Realtime. Sin retrasos molestos, tus mensajes llegan al instante.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <EyeOff size={24} />
            </div>
            <h3 className="feature-title">100% Privado</h3>
            <p className="feature-desc">Sin anuncios invasivos, sin trackers, sin vender tus datos. Tu privacidad no es negociable.</p>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="section" style={{ background: 'var(--bg-tertiary)' }}>
        <h2 className="section-title">Empieza en segundos</h2>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3 className="step-title">Regístrate</h3>
            <p className="step-desc">Crea tu cuenta gratis en segundos, sin verificación obligatoria.</p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3 className="step-title">Únete a un grupo</h3>
            <p className="step-desc">Crea el tuyo propio o busca grupos públicos de tu interés.</p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3 className="step-title">Comparte sin miedo</h3>
            <p className="step-desc">Sube tus archivos, envía mensajes. Eres libre.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta-section">
        <h2 className="cta-title">Únete a Misil.<br />La red que no te juzga.</h2>
        <Link to="/login" className="btn btn-primary cta-button">
          Crear cuenta gratis
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-brand">
          <img src="/favicon.svg" alt="Misil logo" style={{ width: 24, height: 24 }} />
          <span className="landing-brand-text" style={{ fontSize: 20 }}>MISIL</span>
        </div>

        <div className="footer-links">
          <Link to="#" className="footer-link">Términos</Link>
          <Link to="#" className="footer-link">Privacidad</Link>
          <Link to="/downloader" className="footer-link">Misil Downloader</Link>
        </div>

        <div className="footer-copy">
          © 2025 Misil. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};
