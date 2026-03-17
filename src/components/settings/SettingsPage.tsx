import { useState, FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, User, Lock, Bell, Shield, ChevronRight, Check, LogOut } from 'lucide-react';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { user, updateProfile, changePassword, logout, error } = useAuthStore();
  const [view, setView] = useState<'main' | 'profile' | 'password' | 'notifications'>('main');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [status, setStatus] = useState(user?.status || '');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [notifications, setNotifications] = useState(true);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await updateProfile({ display_name: displayName, status });
    setSaving(false);
    if (ok) setSuccess('Perfil actualizado');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) return;
    if (newPwd.length < 6) return;
    setSaving(true);
    const ok = await changePassword(currentPwd, newPwd);
    setSaving(false);
    if (ok) {
      setSuccess('Contraseña cambiada exitosamente');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    }
    setTimeout(() => setSuccess(''), 3000);
  };

  if (!user) return null;

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="settings-page">
      <div className="chat-header">
        <button
          className="btn-icon mobile-back-btn show-on-mobile"
          onClick={view === 'main' ? () => { onBack(); window.history.back(); } : () => setView('main')}
          style={{ padding: '8px 4px', marginRight: 0 }}
        >
          <ArrowLeft size={24} />
        </button>
        <button className="btn-icon hide-on-mobile" onClick={view === 'main' ? onBack : () => setView('main')}>
          <ArrowLeft size={20} />
        </button>
        <div className="chat-header-info" style={{ marginLeft: 12 }}>
          <h3>{view === 'main' ? 'Configuración' : view === 'profile' ? 'Editar perfil' : view === 'password' ? 'Cambiar contraseña' : 'Notificaciones'}</h3>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {success && <div className="success-message" style={{ margin: 16 }}>{success}</div>}
        {error && <div className="error-message" style={{ margin: 16 }}>{error}</div>}

        {view === 'main' && (
          <>
            {/* Profile header */}
            <div className="group-panel-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="group-panel-avatar">
                {getInitials(user.display_name || user.username)}
              </div>
              <h3>{user.display_name || user.username}</h3>
              <p>@{user.username}</p>
              {user.status && <p style={{ marginTop: 4, fontSize: 13 }}>{user.status}</p>}
            </div>

            {/* Settings items */}
            <div className="settings-section">
              <div className="settings-item" onClick={() => setView('profile')} style={{ cursor: 'pointer' }}>
                <div className="settings-item-label">
                  <User size={20} color="var(--accent)" />
                  <div>
                    <span>Editar perfil</span>
                    <small>Nombre, estado, avatar</small>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>

              <div className="settings-item" onClick={() => setView('password')} style={{ cursor: 'pointer' }}>
                <div className="settings-item-label">
                  <Lock size={20} color="var(--accent)" />
                  <div>
                    <span>Cambiar contraseña</span>
                    <small>Actualiza tu contraseña</small>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
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
              Chat Latino v1.0.0<br />
              Privacidad primero 🔒
            </div>
          </>
        )}

        {view === 'profile' && (
          <form onSubmit={handleSaveProfile}>
            <div className="settings-section">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Nombre de usuario</label>
                <input className="form-input" value={`@${user.username}`} disabled style={{ opacity: 0.5 }} />
                <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>No se puede cambiar</small>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Nombre para mostrar</label>
                <input
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={30}
                  placeholder=""
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Estado</label>
                <input
                  className="form-input"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  maxLength={100}
                  placeholder=""
                />
              </div>

              <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}

        {view === 'password' && (
          <form onSubmit={handleChangePassword}>
            <div className="settings-section">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Contraseña actual</label>
                <input
                  className="form-input"
                  type="password"
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Nueva contraseña</label>
                <input
                  className="form-input"
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Confirmar nueva contraseña</label>
                <input
                  className="form-input"
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  minLength={6}
                  required
                />
                {newPwd && confirmPwd && newPwd !== confirmPwd && (
                  <small style={{ color: 'var(--accent-red)' }}>Las contraseñas no coinciden</small>
                )}
              </div>

              <button
                className="btn btn-primary btn-full"
                type="submit"
                disabled={saving || !currentPwd || !newPwd || newPwd !== confirmPwd}
              >
                {saving ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
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
