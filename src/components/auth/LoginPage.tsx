import { useState, FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { requestNotificationPermission, subscribeUserToPush } from '../../services/notifications/webPush';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const { login, register, loading, error, clearError } = useAuthStore();

  const handlePushSubscription = async (userId: string) => {
    const granted = await requestNotificationPermission();
    if (granted) {
      await subscribeUserToPush(userId);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let success = false;
    if (isRegister) {
      success = await register(username, password, displayName || username);
    } else {
      success = await login(username, password);
    }

    if (success) {
      // Small timeout to ensure state is set
      setTimeout(() => {
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          handlePushSubscription(userId);
        }
      }, 1000);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    clearError();
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <BrandLogo size={60} />
          </div>
          <h1>Misil</h1>
          <p>{isRegister ? 'Crea tu cuenta privada' : 'Inicia sesión en tu cuenta'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Nombre de usuario</label>
            <input
              className="form-input"
              type="text"
              placeholder=""
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              required
              minLength={3}
              maxLength={20}
              autoComplete="username"
            />
          </div>

          {isRegister && (
            <div className="form-group">
              <label>Nombre para mostrar</label>
              <input
                className="form-input"
                type="text"
                placeholder=""
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
              />
            </div>
          )}

          <div className="form-group">
            <label>Contraseña</label>
            <div className="password-input-container">
              <input
                className="form-input"
                type={showPassword ? "text" : "password"}
                placeholder=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            type="submit"
            disabled={loading || !username || !password}
          >
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : isRegister ? (
              'Crear cuenta'
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? (
            <>¿Ya tienes cuenta? <a onClick={toggleMode}>Inicia sesión</a></>
          ) : (
            <>¿No tienes cuenta? <a onClick={toggleMode}>Regístrate</a></>
          )}
        </div>
      </div>
    </div>
  );
}
