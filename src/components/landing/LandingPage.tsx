import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Users, ImageIcon, Zap, EyeOff, XCircle, CheckCircle, MessageCircle, Send } from 'lucide-react';
import { Navbar } from './Navbar';
import './LandingPage.css';
import { getOnlineUsersCount } from '../../services/stats/userCount';

export const LandingPage = () => {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      const count = await getOnlineUsersCount();
      setOnlineCount(count);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-page">
      <Navbar />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg" />
        <div className="hero-content">
          {onlineCount !== null && (
            <div className="online-badge">
              <span className="pulsing-dot"></span>
              {onlineCount} usuarios online ahora
            </div>
          )}
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

      {/* Stats Section */}
      <section className="section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">+10k</div>
            <div className="stat-label">Usuarios Libres</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">5M+</div>
            <div className="stat-label">Mensajes Enviados</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">0</div>
            <div className="stat-label">Archivos Censurados</div>
          </div>
        </div>
      </section>

      {/* Compare Section */}
      <section id="compare" className="section" style={{ background: 'var(--bg-tertiary)' }}>
        <h2 className="section-title">¿Cansado de esto?</h2>

        <div className="competitors-grid">
          <div className="competitor-card">
            <div className="competitor-header">
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <MessageCircle size={24} />
              </div>
              <div className="competitor-name">WhatsApp</div>
            </div>
            <ul className="competitor-list">
              <li><XCircle className="competitor-icon" size={20} /> <span>Comparte tus datos con Meta para publicidad<br/><small style={{color: 'var(--text-muted)'}}>Todo alimenta el algoritmo de anuncios de Facebook</small></span></li>
            </ul>
          </div>

          <div className="competitor-card">
            <div className="competitor-header">
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Send size={24} />
              </div>
              <div className="competitor-name">Telegram</div>
            </div>
            <ul className="competitor-list">
              <li><XCircle className="competitor-icon" size={20} /> <span>Elimina canales y grupos sin previo aviso<br/><small style={{color: 'var(--text-muted)'}}>Modera contenido activamente. Tu grupo puede desaparecer mañana</small></span></li>
            </ul>
          </div>

          <div className="competitor-card">
            <div className="competitor-header">
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#8c8c8c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Shield size={24} />
              </div>
              <div className="competitor-name">Signal</div>
            </div>
            <ul className="competitor-list">
              <li><XCircle className="competitor-icon" size={20} /> <span>Sin copias de seguridad en la nube<br/><small style={{color: 'var(--text-muted)'}}>Pierdes tu teléfono = pierdes TODO tu historial</small></span></li>
            </ul>
          </div>
        </div>

        <div className="contrast-banner">
          <CheckCircle size={48} color="var(--accent-green)" style={{ margin: '0 auto 16px' }} />
          <h3>MISIL → Sin censura. Sin tracking. TÚ mandas.</h3>
          <p>Tú eres el dueño de tus conversaciones y archivos.</p>
        </div>

        <div className="comparison-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="feature-col">Característica</th>
                <th className="misil-col">Misil</th>
                <th>WhatsApp</th>
                <th>Telegram</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="feature-col">Cero Censura</td>
                <td className="misil-col">Sí</td>
                <td>No</td>
                <td>No</td>
                <td>Sí</td>
              </tr>
              <tr>
                <td className="feature-col">Canales sin límites</td>
                <td className="misil-col">Sí</td>
                <td>No</td>
                <td>Sí</td>
                <td>No</td>
              </tr>
              <tr>
                <td className="feature-col">Archivos grandes</td>
                <td className="misil-col">Hasta 500MB</td>
                <td>100MB</td>
                <td>2GB</td>
                <td>100MB</td>
              </tr>
              <tr>
                <td className="feature-col">No Tracking</td>
                <td className="misil-col">Sí</td>
                <td>No</td>
                <td>No</td>
                <td>Sí</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="section">
        <h2 className="section-title">Lo que dicen los usuarios</h2>
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <div className="testimonial-header">
              <div className="testimonial-avatar" style={{ background: '#ff7eb3' }}></div>
              <div>
                <div className="testimonial-name">Alex G.</div>
                <div className="testimonial-role">Creador de contenido</div>
              </div>
            </div>
            <p className="testimonial-text">"Me banearon 3 grupos de Telegram sin razón. En Misil por fin tengo paz mental de que mi comunidad no va a desaparecer de la noche a la mañana."</p>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-header">
              <div className="testimonial-avatar" style={{ background: '#7ec4ff' }}></div>
              <div>
                <div className="testimonial-name">María P.</div>
                <div className="testimonial-role">Activista</div>
              </div>
            </div>
            <p className="testimonial-text">"La privacidad es real. No te piden número de teléfono y nadie está revisando lo que publicamos. Exactamente lo que necesitábamos."</p>
          </div>
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
