import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Play, Music, Radio, Download, Loader2, ArrowLeft } from 'lucide-react';
import './DownloaderPage.css';

interface Format {
  id: string;
  label: string;
  ext: string;
  quality: string;
  isAudioOnly?: boolean;
}

interface AnalyzeResult {
  platform: 'youtube' | 'youtubemusic' | 'deezer';
  title: string;
  thumbnail: string;
  formats: Format[];
}

const getPlatformFromUrl = (url: string) => {
  if (!url) return null;
  const lurl = url.toLowerCase();
  if (lurl.includes('music.youtube.com')) return 'youtubemusic';
  if (lurl.includes('youtube.com') || lurl.includes('youtu.be')) return 'youtube';
  if (lurl.includes('deezer.com') || lurl.includes('deezer.page.link')) return 'deezer';
  return null;
};

const PlatformLogo = ({ platform }: { platform: string | null }) => {
  if (platform === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#FF0000">
        <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M9.996,15.5v-7l6.504,3.5L9.996,15.5z"/>
      </svg>
    );
  }
  if (platform === 'youtubemusic') {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#FF0000">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
      </svg>
    );
  }
  if (platform === 'deezer') {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#FEAA2D">
        <path d="M12 10.334v2.778h-2.91v-2.778H12zm-3.863 0v2.778H5.228v-2.778h2.91zm7.726 0v2.778h-2.91v-2.778h2.91zm3.863 0v2.778h-2.91v-2.778h2.91zm-11.59 3.555v2.778H5.228v-2.778h2.91zm3.864 0v2.778h-2.91v-2.778h2.91zm3.863 0v2.778h-2.91v-2.778h2.91zm3.863 0v2.778h-2.91v-2.778h2.91zM12 6.778v2.778h-2.91V6.778H12zm3.863 0v2.778h-2.91V6.778h2.91zm-7.726-3.555v2.778H5.228V3.223h2.91z"/>
      </svg>
    );
  }
  return null;
};

export const DownloaderPage = () => {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const detectedPlatform = getPlatformFromUrl(url);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No estás autenticado');

      const apiUrl = `${import.meta.env.VITE_WORKER_URL || 'https://chat-latino-backend.josanager15.workers.dev'}/api/downloader/analyze`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ url })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al analizar la URL');

      setResult(data);
      if (data.formats && data.formats.length > 0) {
        setSelectedFormat(data.formats[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownload = async () => {
    if (!url || !selectedFormat || !result) return;

    setDownloading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No estás autenticado');

      const format = result.formats.find(f => f.id === selectedFormat);
      if (!format) throw new Error('Formato no válido');

      const apiUrl = `${import.meta.env.VITE_WORKER_URL || 'https://chat-latino-backend.josanager15.workers.dev'}/api/downloader/download`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          url,
          format: format.ext,
          quality: format.quality,
          audioOnly: format.isAudioOnly
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al preparar la descarga');

      if (data.downloadUrl) {
        // Trigger download
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.filename || 'download';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="downloader-page">
      <div className="animated-background">
        <div className="wave wave1"></div>
        <div className="wave wave2"></div>
        <div className="wave wave3"></div>
        {[...Array(20)].map((_, i) => (
          <div key={i} className={`background-particle p${i}`}></div>
        ))}
      </div>
      
      <header className="downloader-header">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '32px' }}>
          <ArrowLeft size={20} /> Volver a Misil
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <BrandLogo size={64} />
          <h1 className="downloader-title">Misil Downloader</h1>
          <p className="downloader-subtitle">
            El mejor descargador de contenido de YouTube, YouTube Music y Deezer
          </p>
        </div>
      </header>

      <main className="downloader-content">
        {!user ? (
          <>
            <div className="platforms-grid">
              <div className="platform-card">
                <div className="platform-icon" style={{ color: '#ff0000', background: 'rgba(255, 0, 0, 0.1)' }}>
                  <Play size={24} />
                </div>
                <h3>YouTube</h3>
                <ul className="platform-features">
                  <li><Download size={16} /> Videos MP4 (360p a 4K)</li>
                  <li><Download size={16} /> Audio MP3 / M4A</li>
                  <li><Download size={16} /> Alta velocidad</li>
                </ul>
              </div>
              <div className="platform-card">
                <div className="platform-icon" style={{ color: '#ff0000', background: 'rgba(255, 0, 0, 0.1)' }}>
                  <Music size={24} />
                </div>
                <h3>YouTube Music</h3>
                <ul className="platform-features">
                  <li><Download size={16} /> Audio MP3</li>
                  <li><Download size={16} /> Audio M4A / OPUS</li>
                  <li><Download size={16} /> Alta calidad</li>
                </ul>
              </div>
              <div className="platform-card" style={{ opacity: 0.7 }}>
                <div className="platform-icon" style={{ color: '#feaa2d', background: 'rgba(254, 170, 45, 0.1)' }}>
                  <Radio size={24} />
                </div>
                <h3>Deezer</h3>
                <ul className="platform-features">
                  <li><Download size={16} /> Audio MP3 128kbps/320kbps</li>
                  <li><Download size={16} /> FLAC (Requiere Premium)</li>
                  <li style={{ color: 'var(--accent)' }}>Próximamente</li>
                </ul>
              </div>
            </div>

            <div className="auth-cta">
              <h2>Comienza a descargar</h2>
              <p>Inicia sesión o regístrate en Misil para usar el descargador de forma gratuita y sin límites.</p>
              <div className="auth-buttons">
                <Link to="/login" className="btn btn-secondary">Iniciar sesión</Link>
                <Link to="/login" className="btn btn-primary">Registrarse</Link>
              </div>
            </div>
          </>
        ) : (
          <div className="downloader-app">
            <form onSubmit={handleAnalyze} className="input-group">
              <div className="input-wrapper">
                {detectedPlatform && (
                  <div className="input-platform-logo">
                    <PlatformLogo platform={detectedPlatform} />
                  </div>
                )}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Pega el enlace de YouTube o Deezer aquí..."
                  className={`url-input ${detectedPlatform ? 'has-logo' : ''}`}
                  required
                  disabled={analyzing || downloading}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-analyze"
                disabled={!url || analyzing || downloading}
              >
                {analyzing ? <Loader2 className="spinner" size={20} /> : 'Analizar'}
              </button>
            </form>

            {error && (
              <div style={{ color: '#ff4b4b', background: 'rgba(255, 75, 75, 0.1)', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            {result && (
              <div className="result-card">
                <div className="result-header">
                  {result.thumbnail ? (
                    <img src={result.thumbnail} alt="Thumbnail" className="result-thumbnail" />
                  ) : (
                    <div className="result-thumbnail">
                       {result.platform.includes('youtube') ? <Play size={32} /> : <Radio size={32} />}
                    </div>
                  )}
                  <div className="result-info">
                    <div className={`result-platform platform-${result.platform}`}>
                      {result.platform === 'youtube' && <><Play size={14} /> YouTube</>}
                      {result.platform === 'youtubemusic' && <><Music size={14} /> YT Music</>}
                      {result.platform === 'deezer' && <><Radio size={14} /> Deezer</>}
                    </div>
                    <div className="result-title" title={result.title}>{result.title}</div>
                  </div>
                </div>

                <div className="download-options">
                  <select
                    className="format-select"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    disabled={downloading}
                  >
                    {result.formats.map(format => (
                      <option key={format.id} value={format.id}>
                        {format.label}
                      </option>
                    ))}
                  </select>

                  <button
                    className="btn btn-primary btn-download"
                    onClick={handleDownload}
                    disabled={downloading || !selectedFormat}
                  >
                    {downloading ? (
                      <><Loader2 className="spinner" size={20} /> Preparando descarga...</>
                    ) : (
                      <><Download size={20} /> Descargar ahora</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
