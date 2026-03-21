import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './components/auth/LoginPage';
import { MainLayout } from './components/layout/MainLayout';
import { LandingPage } from './components/landing/LandingPage';
import { DownloaderPage } from './components/downloader/DownloaderPage';
import { BrandLogo } from './components/common/BrandLogo';
import './index.css';

function AppRoutes() {
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

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/chat" element={user ? <MainLayout /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <LoginPage />} />
      <Route path="/downloader" element={<DownloaderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
