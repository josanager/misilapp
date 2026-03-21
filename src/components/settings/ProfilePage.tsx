import { useState, FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ProfilePage() {
  const { user, updateProfile, changePassword, error } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [status, setStatus] = useState(user?.status || '');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
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
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </div>
        </form>

        <form onSubmit={handleChangePassword} style={{ marginBottom: 32 }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seguridad</h4>
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

        {/* Misil Downloader Button section */}
        <h4 style={{ color: 'var(--accent)', marginBottom: 16, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Herramientas</h4>
        <Link
          to="/downloader"
          className="btn-full"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            color: '#fff',
            padding: '14px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(255, 49, 49, 0.2)'
          }}
          title="Acceder a Misil Downloader"
        >
          <Download size={20} />
          Misil Downloader
        </Link>
      </div>
    </div>
  );
}
