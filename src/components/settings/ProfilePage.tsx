import { useState, FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';

export function ProfilePage() {
  const { user, updateProfile, error } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [status, setStatus] = useState(user?.status || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await updateProfile({ display_name: displayName, status });
    setSaving(false);
    if (ok) setSuccess('Perfil actualizado');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (!user) return null;

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="settings-page" style={{ paddingBottom: '20px' }}>
      <div className="chat-header">
        <div className="chat-header-info" style={{ marginLeft: 12 }}>
          <h3>Perfil</h3>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {success && <div className="success-message" style={{ marginBottom: 16 }}>{success}</div>}
        {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="group-panel-header" style={{ borderBottom: '1px solid var(--border)', marginBottom: 24, paddingBottom: 24 }}>
          <div className="group-panel-avatar">
            {getInitials(user.display_name || user.username)}
          </div>
          <h3>{user.display_name || user.username}</h3>
          <p>@{user.username}</p>
        </div>

        <form onSubmit={handleSaveProfile} style={{ marginBottom: 32 }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Editar Información</h4>
          <div className="settings-section">
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Nombre de usuario</label>
              <input className="form-input" value={`@${user.username}`} disabled style={{ opacity: 0.5 }} />
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Identidad privada de este equipo</small>
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
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </div>
        </form>

        <div className="settings-section">
          <div className="settings-item-label">
            <div>
              <span>Perfil local</span>
              <small>No existe una contraseña remota en esta fase. El perfil vive únicamente en este equipo.</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
