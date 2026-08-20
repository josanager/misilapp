import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout/MainLayout';
import { BrandLogo } from './components/common/BrandLogo';
import { PublicLandingPage } from './components/landing/PublicLandingPage';
import { WebChatPage } from './components/web/WebChatPage';
import './index.css';
import './public.css';

function LocalNodeRoute() {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div className="pulse-animation">
            <BrandLogo size={80} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, fontWeight: 500, letterSpacing: '0.05em' }}>Cargando Misil...</p>
        </div>
      </div>
    );
  }

  return user ? <MainLayout /> : <NodeUnavailable />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicLandingPage />} />
      <Route path="/chat" element={<WebChatPage />} />
      <Route path="/local" element={<LocalNodeRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function NodeUnavailable() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandLogo size={64} />
        <h1>MISIL Node no responde</h1>
        <p>Abre la aplicación nativa de MISIL para administrar los datos y archivos de este equipo.</p>
        <button className="btn btn-primary btn-full" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
