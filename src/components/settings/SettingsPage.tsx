import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Bell, Shield, ChevronRight, Check, LogOut } from 'lucide-react';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { user, logout, error } = useAuthStore();
  const [view, setView] = useState<'main' | 'notifications'>('main');
  const [notifications, setNotifications] = useState(true);

  if (!user) return null;

  return (
    <div className="settings-page" style={{ paddingBottom: '20px' }}>
      <div className="chat-header">
        <button
          className="btn-icon mobile-back-btn show-on-mobile"
          onClick={view === 'main' ? onBack : () => setView('main')}
          style={{ padding: '8px 4px', marginRight: 0 }}
        >
          <ArrowLeft size={24} />
        </button>
        <button className="btn-icon hide-on-mobile" onClick={view === 'main' ? onBack : () => setView('main')}>
          <ArrowLeft size={20} />
        </button>
        <div className="chat-header-info" style={{ marginLeft: 12 }}>
          <h3>{view === 'main' ? 'Configuración Web' : 'Notificaciones'}</h3>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

        {view === 'main' && (
          <>
            <div className="settings-section">
              <div className="settings-item" onClick={() => setView('notifications')} style={{ cursor: 'pointer' }}>
                <div className="settings-item-label">
                  <Bell size={20} color="var(--accent)" />
                  <div>
                    <span>Notificaciones</span>
                    <small>Configura las alertas</small>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>

              <div className="settings-item">
                <div className="settings-item-label">
                  <Shield size={20} color="var(--accent-green)" />
                  <div>
                    <span>Cifrado E2E</span>
                    <small>Tus mensajes están protegidos</small>
                  </div>
                </div>
                <Check size={18} color="var(--accent-green)" />
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-item" onClick={logout} style={{ cursor: 'pointer' }}>
                <div className="settings-item-label">
                  <LogOut size={20} color="var(--accent-red)" />
                  <div>
                    <span style={{ color: 'var(--accent-red)' }}>Cerrar sesión</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
              Misil v1.0.0<br />
              Privacidad primero 🔒
            </div>
          </>
        )}

        {view === 'notifications' && (
          <div className="settings-section">
            <div className="settings-item">
              <div className="settings-item-label">
                <div>
                  <span>Notificaciones de mensajes</span>
                  <small>Recibe alertas de nuevos mensajes</small>
                </div>
              </div>
              <div
                className={`toggle ${notifications ? 'active' : ''}`}
                onClick={() => setNotifications(!notifications)}
              />
            </div>

            <div className="settings-item">
              <div className="settings-item-label">
                <div>
                  <span>Sonido</span>
                  <small>Reproduce sonido con notificaciones</small>
                </div>
              </div>
              <div className="toggle active" />
            </div>

            <div className="settings-item">
              <div className="settings-item-label">
                <div>
                  <span>Notificaciones de grupo</span>
                  <small>Recibe alertas cuando mencionan tu nombre</small>
                </div>
              </div>
              <div className="toggle active" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
