import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';

export const DownloaderPage = () => {
  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <BrandLogo size={80} />
      <h1 style={{
        fontSize: '2.5rem',
        fontWeight: 'bold',
        marginTop: '2rem',
        marginBottom: '1rem',
        background: 'var(--accent-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        Misil Downloader
      </h1>
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '1.25rem',
        marginBottom: '3rem',
        maxWidth: '500px'
      }}>
        Próximamente. Algo grande se está construyendo.
      </p>

      <Link
        to="/"
        className="btn btn-primary"
        style={{ textDecoration: 'none', padding: '0.75rem 2rem' }}
      >
        Volver a Misil
      </Link>
    </div>
  );
};
