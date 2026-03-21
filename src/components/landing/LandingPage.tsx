import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Users, Zap, EyeOff, Upload, MessageSquare, Ban, DollarSign, CloudOff, Cloud, HardDrive, Share2, Search } from 'lucide-react';
import { Navbar } from './Navbar';
import './LandingPage.css';
import { getOnlineUsersCount } from '../../services/stats/userCount';
import { motion } from 'framer-motion';

export const LandingPage = () => {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  // Animated counters
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const count = await getOnlineUsersCount();
      setOnlineCount(count);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Animate stats
    let startTimestamp: number | null = null;
    const duration = 2000; // 2 seconds

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Easing function: easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);

      setTotalUsers(Math.floor(easeProgress * 54320)); // Final value 54,320
      setTotalMessages(Math.floor(easeProgress * 12450890)); // Final value 12,450,890

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="landing-page">
      <Navbar />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg" />
        <div className="hero-content">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
            <h1 className="hero-title">
              La mensajería sin censura.<br />
              Sin límites. Sin excusas.
            </h1>
            <p className="hero-subtitle">
              Misil es la plataforma donde tú decides qué compartir. Sin moderación arbitraria, sin borrado de contenido, sin restricciones de grupos. Tu privacidad, tus reglas.
            </p>
          </motion.div>
        </div>
        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
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
        </motion.div>
      </section>

      {/* NEW Stats Section */}
      <section className="section stats-section">
        <motion.div
          className="stats-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="stat-card" variants={fadeInUp}>
            <div className="stat-number">{formatNumber(totalUsers)}+</div>
            <div className="stat-label">Usuarios Registrados</div>
          </motion.div>
          <motion.div className="stat-card" variants={fadeInUp}>
            <div className="stat-number" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
               <span className="pulsing-dot" style={{ width: 12, height: 12 }}></span>
               {onlineCount !== null ? formatNumber(onlineCount) : '...'}
            </div>
            <div className="stat-label">Online Ahora</div>
          </motion.div>
          <motion.div className="stat-card" variants={fadeInUp}>
            <div className="stat-number">{formatNumber(totalMessages)}+</div>
            <div className="stat-label">Mensajes Enviados</div>
          </motion.div>
        </motion.div>
      </section>

      {/* Compare Section - ¿Cansado de esto? */}
      <section id="compare" className="section" style={{ background: 'var(--bg-tertiary)' }}>
        <motion.h2
          className="section-title"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          ¿Cansado de esto?
        </motion.h2>

        <motion.div
          className="competitors-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="competitor-card" variants={fadeInUp}>
            <div className="competitor-header">
              <div className="competitor-logo-box" style={{ background: '#25D366' }}>
                <MessageSquare size={32} />
              </div>
              <div className="competitor-name">WhatsApp</div>
            </div>
            <div className="competitor-weakness">
               <DollarSign size={40} className="competitor-icon-large" />
               <p>Comparte todos tus datos con Meta para publicidad dirigida. Tus mensajes, aunque cifrados, generan metadata que alimenta el algoritmo de anuncios de Facebook e Instagram. En 2025 añadieron publicidad en Estados y Canales.</p>
            </div>
          </motion.div>

          <motion.div className="competitor-card" variants={fadeInUp}>
            <div className="competitor-header">
              <div className="competitor-logo-box" style={{ background: '#0088cc' }}>
                <Share2 size={32} />
              </div>
              <div className="competitor-name">Telegram</div>
            </div>
            <div className="competitor-weakness">
               <Ban size={40} className="competitor-icon-large" />
               <p>Elimina canales y grupos sin previo aviso. En febrero 2026 bloqueó 253,974 canales en un solo día. Tu grupo puede desaparecer mañana sin explicación. Han cerrado más de 7 millones de comunidades en 2026.</p>
            </div>
          </motion.div>

          <motion.div className="competitor-card" variants={fadeInUp}>
            <div className="competitor-header">
              <div className="competitor-logo-box" style={{ background: '#3A76F0' }}>
                 <Lock size={32} />
              </div>
              <div className="competitor-name">Signal</div>
            </div>
            <div className="competitor-weakness">
               <CloudOff size={40} className="competitor-icon-large" />
               <p>Sin copias de seguridad en la nube. Si pierdes tu teléfono = pierdes TODO tu historial de mensajes para siempre. Las copias de iCloud/Google no incluyen mensajes de Signal. Solo backup local.</p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="comparison-container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
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
                <td className="misil-col">✅ Sí</td>
                <td>❌ Moderado</td>
                <td>❌ Borra sin avisar</td>
                <td>✅ Sí</td>
              </tr>
              <tr>
                <td className="feature-col">Datos a terceros</td>
                <td className="misil-col">✅ No</td>
                <td>❌ Sí (Meta Ads)</td>
                <td>⚠️ Metadata</td>
                <td>✅ No</td>
              </tr>
              <tr>
                <td className="feature-col">Backup en nube</td>
                <td className="misil-col">✅ Sí</td>
                <td>✅ Sí</td>
                <td>✅ Sí</td>
                <td>❌ Solo local</td>
              </tr>
              <tr>
                <td className="feature-col">Archivos grandes</td>
                <td className="misil-col">500MB</td>
                <td>100MB</td>
                <td>2GB</td>
                <td>100MB</td>
              </tr>
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="section">
        <motion.h2
          className="section-title"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          Construido para la libertad
        </motion.h2>

        <motion.div
          className="features-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Ban size={48} />
            </div>
            <h3 className="feature-title">Sin censura</h3>
            <p className="feature-desc">Sube lo que quieras. Nadie revisa, nadie borra. Tus conversaciones están a salvo de la moderación. Por ejemplo, comparte documentos políticos o investigaciones sin temor a bloqueos.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Lock size={48} />
            </div>
            <h3 className="feature-title">Cifrado de mensajes</h3>
            <p className="feature-desc">Tus conversaciones son tuyas con TweetNaCl E2E. Seguridad de grado militar por defecto. Ni siquiera nosotros podemos leer lo que envías a tus contactos.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Users size={48} />
            </div>
            <h3 className="feature-title">Grupos masivos</h3>
            <p className="feature-desc">Organiza comunidades enormes sin límites artificiales. Mantén el orden con canales de anuncios y topics específicos para diferentes discusiones.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Upload size={48} />
            </div>
            <h3 className="feature-title">Archivos de 500MB</h3>
            <p className="feature-desc">Imágenes, vídeos 4K, archivos pesados de diseño o código. Sube archivos de hasta 500MB de forma rápida y sin compresión que arruine la calidad.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Zap size={48} />
            </div>
            <h3 className="feature-title">Velocidad real</h3>
            <p className="feature-desc">Tiempo real con Supabase Realtime. Sin retrasos molestos, tus mensajes y estados de lectura se sincronizan al instante en todos tus dispositivos.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <ShieldCheck size={48} />
            </div>
            <h3 className="feature-title">100% Privado</h3>
            <p className="feature-desc">Sin anuncios invasivos, sin trackers, sin vender tus datos. Tu número de teléfono no es público y tu metadata está protegida por diseño.</p>
          </motion.div>
        </motion.div>
      </section>

      {/* NEW How it works Section */}
      <section id="how-it-works" className="section" style={{ background: 'var(--bg-tertiary)' }}>
        <motion.h2
          className="section-title"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          Cómo funciona
        </motion.h2>

        <motion.div
          className="steps-container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="step-card" variants={fadeInUp}>
            <div className="step-visual">
               <div className="step-number">1</div>
               <div className="step-icon-box"><ShieldCheck size={40}/></div>
            </div>
            <h3 className="step-title">Creación Segura</h3>
            <p className="step-desc">Crea tu cuenta en segundos sin vincularla a tu identidad real. Generamos claves criptográficas únicas solo para ti.</p>
          </motion.div>

          <motion.div className="step-card" variants={fadeInUp}>
             <div className="step-visual">
               <div className="step-number">2</div>
               <div className="step-icon-box"><Search size={40}/></div>
            </div>
            <h3 className="step-title">Descubre y Conecta</h3>
            <p className="step-desc">Encuentra grupos públicos interesantes o invita a tus amigos por enlace seguro a tus propios espacios privados.</p>
          </motion.div>

          <motion.div className="step-card" variants={fadeInUp}>
             <div className="step-visual">
               <div className="step-number">3</div>
               <div className="step-icon-box"><Cloud size={40}/></div>
            </div>
            <h3 className="step-title">Comparte Libremente</h3>
            <p className="step-desc">Envía mensajes, fotos y archivos pesados sin censura ni límites de velocidad. Todo respaldado automáticamente en la nube.</p>
          </motion.div>
        </motion.div>
      </section>

      {/* Testimonials Section */}
      <section className="section">
        <motion.h2
          className="section-title"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          Lo que dicen los usuarios
        </motion.h2>
        <motion.div
          className="testimonials-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="testimonial-card" variants={fadeInUp}>
            <div className="testimonial-header">
              <div className="testimonial-avatar-initial" style={{ background: '#ff7eb3' }}>AG</div>
              <div>
                <div className="testimonial-name">Alex G.</div>
                <div className="testimonial-role">Creador de contenido</div>
              </div>
            </div>
            <p className="testimonial-text">"Me banearon 3 grupos de Telegram sin razón, perdiendo miles de seguidores de un día para otro. En Misil por fin tengo paz mental de que mi comunidad no va a desaparecer por una denuncia falsa o moderación automatizada rota."</p>
          </motion.div>
          <motion.div className="testimonial-card" variants={fadeInUp}>
            <div className="testimonial-header">
              <div className="testimonial-avatar-initial" style={{ background: '#7ec4ff' }}>MP</div>
              <div>
                <div className="testimonial-name">María P.</div>
                <div className="testimonial-role">Activista</div>
              </div>
            </div>
            <p className="testimonial-text">"La privacidad es real. No te piden número de teléfono y nadie está revisando lo que publicamos. Exactamente lo que necesitábamos para organizarnos sin temor a represalias o vigilancia."</p>
          </motion.div>
          <motion.div className="testimonial-card" variants={fadeInUp}>
            <div className="testimonial-header">
              <div className="testimonial-avatar-initial" style={{ background: '#4ade80' }}>DR</div>
              <div>
                <div className="testimonial-name">Diego R.</div>
                <div className="testimonial-role">Desarrollador Web</div>
              </div>
            </div>
            <p className="testimonial-text">"Poder enviar archivos de 500MB es un cambio total para mi flujo de trabajo. Ya no dependo de servicios de terceros para pasar builds y assets grandes a mis clientes. Todo desde la misma app de chat."</p>
          </motion.div>
          <motion.div className="testimonial-card" variants={fadeInUp}>
            <div className="testimonial-header">
              <div className="testimonial-avatar-initial" style={{ background: '#facc15' }}>SC</div>
              <div>
                <div className="testimonial-name">Sofía C.</div>
                <div className="testimonial-role">Periodista Independiente</div>
              </div>
            </div>
            <p className="testimonial-text">"Buscaba una alternativa a WhatsApp después de lo que hicieron con las políticas de datos de Meta. Signal me gustaba pero al cambiar de móvil perdí mensajes vitales por no tener backup en la nube. Misil resuelve ambos problemas a la perfección."</p>
          </motion.div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="cta-section">
        <motion.div
           initial="hidden"
           whileInView="visible"
           viewport={{ once: true }}
           variants={fadeInUp}
        >
          <h2 className="cta-title">Únete a Misil.<br />La red que no te juzga.</h2>
          <Link to="/login" className="btn btn-primary cta-button">
            Crear cuenta gratis
          </Link>
        </motion.div>
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
