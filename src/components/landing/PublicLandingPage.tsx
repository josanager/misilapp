import { ArrowRight, Boxes, Download, Globe2, HardDrive, LockKeyhole, MessageSquareText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';

export function PublicLandingPage() {
  return (
    <main className="public-landing">
      <nav className="public-nav">
        <Link className="public-brand" to="/"><BrandLogo size={32} /><strong>MISIL</strong></Link>
        <div className="public-nav-actions">
          <Link className="btn btn-ghost" to="/chat">Chat web</Link>
          <a className="btn btn-primary" href="/downloads/MISIL-Local-Alpha-0.1.2-macOS-arm64.dmg"><Download size={17} /> Descargar para Mac</a>
        </div>
      </nav>

      <section className="public-hero">
        <div className="public-hero-copy">
          <h1>Tus conversaciones.<br />Tu espacio. <em>Tu red.</em></h1>
          <p>MISIL separa la comunicación del almacenamiento corporativo: habla desde cualquier navegador y utiliza la aplicación nativa para archivos y almacenamiento distribuido.</p>
          <div className="public-hero-actions">
            <Link className="btn btn-primary" to="/chat"><MessageSquareText size={18} /> Abrir chat web</Link>
            <a className="btn btn-secondary" href="/downloads/MISIL-Local-Alpha-0.1.2-macOS-arm64.dmg"><Download size={18} /> App para macOS</a>
          </div>
          <div className="public-trust-line"><LockKeyhole size={16} /> Los mensajes temporales llegan cifrados al relay. Las claves permanecen contigo.</div>
        </div>
        <div className="public-architecture-card" aria-label="Arquitectura de MISIL">
          <div className="architecture-node web"><Globe2 size={22} /><span><strong>MISIL Web</strong><small>Mensajes de texto</small></span></div>
          <div className="architecture-path"><span>cifrado</span></div>
          <div className="architecture-node relay"><Boxes size={22} /><span><strong>Relay temporal</strong><small>7 días · contenido ilegible</small></span></div>
          <div className="architecture-path"><span>sincronización</span></div>
          <div className="architecture-node native"><HardDrive size={22} /><span><strong>Aplicación nativa</strong><small>Archivos y almacenamiento local</small></span></div>
        </div>
      </section>

      <section className="public-principles">
        <article><span>01</span><h2>Web para conversar</h2><p>Accede desde móvil o escritorio sin instalar nada. La versión web acepta exclusivamente texto.</p></article>
        <article><span>02</span><h2>Aplicación para archivos</h2><p>Subidas, descargas y espacio compartido se ejecutan en la aplicación nativa del usuario.</p></article>
        <article><span>03</span><h2>Infraestructura mínima</h2><p>Cloudflare presenta la web y conserva temporalmente sobres cifrados, no archivos ni mensajes legibles.</p></article>
      </section>

      <section className="public-cta">
        <div><h2>Empieza por el chat. Activa tu nodo cuando estés listo.</h2></div>
        <Link className="btn btn-primary" to="/chat">Entrar a MISIL Web <ArrowRight size={18} /></Link>
      </section>

      <footer className="public-footer"><div className="public-brand"><BrandLogo size={24} /><strong>MISIL</strong></div><p>Alpha experimental · No uses todavía MISIL para información crítica.</p></footer>
    </main>
  );
}
