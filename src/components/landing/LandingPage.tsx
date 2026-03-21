import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Users, Zap, Upload, MessageSquare, Ban, Cloud, Search, Send, BellOff } from 'lucide-react';
import { Navbar } from './Navbar';
import './LandingPage.css';
import { getOnlineUsersCount } from '../../services/stats/userCount';
import { getTotalUsersCount, getTotalMessagesCount } from '../../services/statsService';
import { motion } from 'framer-motion';


// Animated Counter component
const AnimatedCounter = ({ value }: { value: number }) => {
  const [count, setCount] = useState(0);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 2000;

    // Intersection observer to start animation
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(easeProgress * value));
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };
          window.requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (nodeRef.current) observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={nodeRef}>{new Intl.NumberFormat('en-US').format(count)}</span>;
};

export const LandingPage = () => {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  // Animated counters
  const [targetUsers, setTargetUsers] = useState(50000);
  const [targetMessages, setTargetMessages] = useState(10000000);

  useEffect(() => {
    const fetchCount = async () => {
      const count = await getOnlineUsersCount();
      setOnlineCount(count);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch real targets for stats
  useEffect(() => {
    const fetchStats = async () => {
      const users = await getTotalUsersCount();
      const messages = await getTotalMessagesCount();
      setTargetUsers(users);
      setTargetMessages(messages);
    };
    fetchStats();
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
            <div className="hero-online-badge">
              <span className="pulsing-dot"></span>
              {onlineCount !== null ? formatNumber(onlineCount) : '...'} usuarios online ahora
            </div>
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
            <div className="stat-number"><AnimatedCounter value={targetUsers} />+</div>
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
            <div className="stat-number"><AnimatedCounter value={targetMessages} />+</div>
            <div className="stat-label">Mensajes Enviados</div>
          </motion.div>
        </motion.div>
      </section>

      {/* Compare Section - ¿Cansado de esto? */}
      <section id="compare" className="section" style={{ background: 'var(--bg-tertiary)' }}>
        <motion.div
          className="section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h2 className="section-title">¿Cansado de que te controlen?</h2>
          <p className="section-subtitle">Las apps que usas tienen un problema gordo:</p>
        </motion.div>

        <motion.div
          className="competitors-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="competitor-card" variants={fadeInUp}>
            <div className="competitor-header">
              <div className="competitor-logo-box" style={{ background: '#ef4444' }}>
                <MessageSquare size={32} color="white" />
              </div>
              <div className="competitor-name">WhatsApp</div>
            </div>
            <div className="competitor-weakness">
               <h4 className="competitor-weakness-title">Tus datos son el producto</h4>
               <p>Meta usa tu metadata para publicidad. En 2025 añadieron anuncios. Tu privacidad, monetizada.</p>
            </div>
          </motion.div>

          <motion.div className="competitor-card" variants={fadeInUp}>
            <div className="competitor-header">
              <div className="competitor-logo-box" style={{ background: '#3b82f6' }}>
                <Send size={32} color="white" />
              </div>
              <div className="competitor-name">Telegram</div>
            </div>
            <div className="competitor-weakness">
               <h4 className="competitor-weakness-title">Tu grupo puede desaparecer mañana</h4>
               <p>En febrero 2026 bloquearon 253,974 canales en UN solo día. Sin aviso. Sin explicación.</p>
            </div>
          </motion.div>

          <motion.div className="competitor-card" variants={fadeInUp}>
            <div className="competitor-header">
              <div className="competitor-logo-box" style={{ background: '#22c55e' }}>
                 <Lock size={32} color="white" />
              </div>
              <div className="competitor-name">Signal</div>
            </div>
            <div className="competitor-weakness">
               <h4 className="competitor-weakness-title">Pierdes el teléfono = pierdes todo</h4>
               <p>Sin backup en la nube. Si rompes tu teléfono, adiós a todo tu historial para siempre.</p>
            </div>
          </motion.div>
        </motion.div>
        <motion.div
          className="competitor-banner"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          MISIL → Sin censura. Sin tracking. Sin límites. TÚ mandas.
        </motion.div>

        <motion.div
          className="comparison-container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h3 className="section-title" style={{marginTop: "60px"}}>La comparación que no quieren que veas</h3>
          <div className="table-responsive">
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
                <motion.tr variants={fadeInUp}>
                  <td className="feature-col">Cero Censura</td>
                  <td className="misil-col">✅</td>
                  <td>❌</td>
                  <td>❌</td>
                  <td>✅</td>
                </motion.tr>
                <motion.tr variants={fadeInUp}>
                  <td className="feature-col">Datos a terceros</td>
                  <td className="misil-col">✅ No</td>
                  <td>❌ Meta Ads</td>
                  <td>⚠️ Metadata</td>
                  <td>✅ No</td>
                </motion.tr>
                <motion.tr variants={fadeInUp}>
                  <td className="feature-col">Backup en nube</td>
                  <td className="misil-col">✅</td>
                  <td>✅</td>
                  <td>✅</td>
                  <td>❌ Solo local</td>
                </motion.tr>
                <motion.tr variants={fadeInUp}>
                  <td className="feature-col">Archivos</td>
                  <td className="misil-col">500MB</td>
                  <td>100MB</td>
                  <td>2GB</td>
                  <td>100MB</td>
                </motion.tr>
                <motion.tr variants={fadeInUp}>
                  <td className="feature-col">Publicidad</td>
                  <td className="misil-col">✅ Nunca</td>
                  <td>❌ Desde 2025</td>
                  <td>⚠️ Canales</td>
                  <td>✅ No</td>
                </motion.tr>
              </tbody>
            </table>
          </div>
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
          Todo lo que necesitas. Sin lo que odias.
        </motion.h2>

        <motion.div
          className="features-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Ban size={48} />
            </div>
            <h3 className="feature-title">Sin Censura</h3>
            <p className="feature-desc">Sube lo que quieras. Nadie revisa, nadie borra.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Lock size={48} />
            </div>
            <h3 className="feature-title">Cifrado E2E</h3>
            <p className="feature-desc">TweetNaCl encripta tus mensajes. Solo tú y tu destinatario.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Users size={48} />
            </div>
            <h3 className="feature-title">Grupos Libres</h3>
            <p className="feature-desc">Crea grupos con topics. Sin riesgo de que los borren.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Upload size={48} />
            </div>
            <h3 className="feature-title">Archivos 500MB</h3>
            <p className="feature-desc">Videos, imágenes, archivos pesados sin restricciones.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <Zap size={48} />
            </div>
            <h3 className="feature-title">Tiempo Real</h3>
            <p className="feature-desc">Supabase Realtime. Mensajes instantáneos sin delay.</p>
          </motion.div>

          <motion.div className="feature-card" variants={fadeInUp}>
            <div className="feature-icon-wrapper">
              <BellOff size={48} />
            </div>
            <h3 className="feature-title">Sin Anuncios</h3>
            <p className="feature-desc">Cero publicidad. Cero tracking. Cero venta de datos.</p>
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
          Empieza en 30 segundos
        </motion.h2>

        <motion.div
          className="steps-container"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          <motion.div className="step-card" variants={fadeInUp}>
            <div className="step-visual">
               <div className="step-number">1</div>
               <div className="step-icon-box"><ShieldCheck size={40}/></div>
            </div>
            <h3 className="step-title">Regístrate</h3>
            <p className="step-desc">Crea tu cuenta gratis. Sin verificación de teléfono obligatoria.</p>
          </motion.div>

          <motion.div className="step-card" variants={fadeInUp}>
             <div className="step-visual">
               <div className="step-number">2</div>
               <div className="step-icon-box"><Search size={40}/></div>
            </div>
            <h3 className="step-title">Únete o crea un grupo</h3>
            <p className="step-desc">Encuentra comunidades o crea la tuya con múltiples topics.</p>
          </motion.div>

          <motion.div className="step-card" variants={fadeInUp}>
             <div className="step-visual">
               <div className="step-number">3</div>
               <div className="step-icon-box"><Cloud size={40}/></div>
            </div>
            <h3 className="step-title">Comparte sin miedo</h3>
            <p className="step-desc">Sube archivos, envía mensajes. Nadie te juzga. Nadie te censura.</p>
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
          Lo que dicen los que ya se pasaron a Misil
        </motion.h2>
        <motion.div
          className="testimonials-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
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
              <div className="testimonial-avatar-initial" style={{ background: '#4ade80' }}>CR</div>
              <div>
                <div className="testimonial-name">Carlos R.</div>
                <div className="testimonial-role">Gamer</div>
              </div>
            </div>
            <p className="testimonial-text">"Comparto capturas y clips sin que me censuren. Telegram me tenía harto."</p>
          </motion.div>
          <motion.div className="testimonial-card" variants={fadeInUp}>
            <div className="testimonial-header">
              <div className="testimonial-avatar-initial" style={{ background: '#facc15' }}>LS</div>
              <div>
                <div className="testimonial-name">Laura S.</div>
                <div className="testimonial-role">Periodista</div>
              </div>
            </div>
            <p className="testimonial-text">"Comunicarme con fuentes sin miedo a que Meta lea mis conversaciones. Misil es indispensable."</p>
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
          <p className="cta-subtitle">Gratis para siempre. Sin tarjeta de crédito.</p>
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
