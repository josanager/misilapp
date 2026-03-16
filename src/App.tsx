import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './components/auth/LoginPage';
import { MainLayout } from './components/layout/MainLayout';
import './index.css';

function App() {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando Chat Latino...</p>
        </div>
      </div>
    );
  }

  return user ? <MainLayout /> : <LoginPage />;
}

export default App;
