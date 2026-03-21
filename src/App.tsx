import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './components/auth/LoginPage';
import { MainLayout } from './components/layout/MainLayout';
import { BrandLogo } from './components/common/BrandLogo';
import './index.css';

function App() {
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

  return user ? <MainLayout /> : <LoginPage />;
}

export default App;
