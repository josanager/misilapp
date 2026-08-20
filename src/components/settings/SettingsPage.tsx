import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { localApi } from '../../services/localApi';
import type { StorageStatus } from '../../types';
import { ArrowLeft, Bell, Shield, ChevronRight, Check, HardDrive, Database, RefreshCw } from 'lucide-react';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { user, error } = useAuthStore();
  const [view, setView] = useState<'main' | 'notifications'>('main');
  const [notifications, setNotifications] = useState(true);
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  const loadStorage = () => localApi.storage().then(setStorage).catch(() => setStorage(null));

  useEffect(() => {
    void loadStorage();
  }, []);

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value.toFixed(unit < 2 ? 0 : 2)} ${units[unit]}`;
  };

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
          <h3>{view === 'main' ? 'Configuración local' : 'Notificaciones'}</h3>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

        {view === 'main' && (
          <>
            <div className="settings-section">
              <div className="settings-item">
                <div className="settings-item-label">
                  <HardDrive size={20} color="var(--accent)" />
                  <div>
                    <span>Almacenamiento del nodo</span>
                    <small>{storage ? `${formatBytes(storage.usedBytes)} usados · ${formatBytes(storage.availableBytes)} disponibles` : 'Nodo local no disponible'}</small>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => void loadStorage()} title="Actualizar uso">
                  <RefreshCw size={17} />
                </button>
              </div>

              <div className="settings-item">
                <div className="settings-item-label">
                  <Database size={20} color="var(--text-secondary)" />
                  <div>
                    <span>Cuota reservada</span>
                    <small>{storage ? formatBytes(storage.quotaBytes) : '10 GB'} · base de datos y archivos locales</small>
                  </div>
                </div>
                <Check size={18} color="var(--accent-green)" />
              </div>

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
                    <span>Cifrado en este equipo</span>
                    <small>AES-256-GCM por bloques; clave privada local</small>
                  </div>
                </div>
                <Check size={18} color="var(--accent-green)" />
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
              MISIL Node v0.1 · perfil local único<br />
              Sin cuentas ni servicios externos
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
