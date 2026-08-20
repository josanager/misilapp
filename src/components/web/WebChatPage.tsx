import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, KeyRound, LockKeyhole, LogOut, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';
import {
  clearRelayIdentity,
  createRelayRoom,
  exportRoomCode,
  joinRelayRoom,
  listRelayMessages,
  loadRelayIdentity,
  sendRelayMessage,
  type RelayIdentity,
} from '../../services/relayCrypto';
import type { Message } from '../../types';

type SetupMode = 'create' | 'join';

export function WebChatPage() {
  const [identity, setIdentity] = useState<RelayIdentity | null>(() => loadRelayIdentity());
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<SetupMode>('create');
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const accessCode = useMemo(() => identity ? exportRoomCode(identity) : '', [identity]);

  const refresh = useCallback(async (activeIdentity: RelayIdentity) => {
    try {
      setMessages(await listRelayMessages(activeIdentity));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar el chat.');
    }
  }, []);

  useEffect(() => {
    if (!identity) return;
    void refresh(identity);
    const interval = window.setInterval(() => void refresh(identity), 2500);
    return () => window.clearInterval(interval);
  }, [identity, refresh]);

  const handleSetup = async (event: FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) return setError('Escribe el nombre que verán los demás.');
    setBusy(true);
    setError('');
    try {
      const nextIdentity = mode === 'create'
        ? await createRelayRoom(displayName)
        : await joinRelayRoom(roomCode, displayName);
      setIdentity(nextIdentity);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'No se pudo preparar MISIL Web.');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!identity || !draft.trim() || busy) return;
    const content = draft.trim();
    setDraft('');
    setBusy(true);
    try {
      const message = await sendRelayMessage(identity, content);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setError('');
    } catch (sendError) {
      setDraft(content);
      setError(sendError instanceof Error ? sendError.message : 'El mensaje no pudo enviarse.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(accessCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!identity) {
    return (
      <main className="web-access-page">
        <Link className="web-back-link" to="/"><ArrowLeft size={16} /> Volver a MISIL</Link>
        <section className="web-access-card">
          <BrandLogo size={56} />
          <div>
            <h1>Mensajes sin instalar la aplicación</h1>
            <p>El navegador sólo enviará texto cifrado. Los archivos y el almacenamiento pertenecen exclusivamente a la app nativa.</p>
          </div>

          <div className="web-mode-tabs" role="tablist" aria-label="Acceso a MISIL Web">
            <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Crear espacio</button>
            <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Usar un código</button>
          </div>

          <form className="web-access-form" onSubmit={handleSetup}>
            <label>
              Nombre visible
              <input className="form-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={32} autoComplete="nickname" />
            </label>
            {mode === 'join' && (
              <label>
                Código privado del espacio
                <textarea className="form-input web-code-input" value={roomCode} onChange={(event) => setRoomCode(event.target.value)} rows={3} />
              </label>
            )}
            {error && <div className="error-message">{error}</div>}
            <button className="btn btn-primary btn-full" disabled={busy}>
              <KeyRound size={18} /> {busy ? 'Preparando…' : mode === 'create' ? 'Crear chat cifrado' : 'Entrar al chat'}
            </button>
          </form>

          <p className="web-access-note"><LockKeyhole size={15} /> Cloudflare recibirá sobres cifrados y los eliminará automáticamente después de siete días.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="web-chat-shell">
      <aside className="web-chat-sidebar">
        <div className="web-chat-brand"><BrandLogo size={28} /><strong>MISIL</strong></div>
        <div className="web-only-badge">WEB · SOLO TEXTO</div>
        <button className="web-room-item active">
          <span className="web-room-avatar">MW</span>
          <span><strong>Mi espacio web</strong><small>Mensajes cifrados temporales</small></span>
        </button>
        <div className="web-chat-sidebar-footer">
          <button className="btn btn-secondary btn-full" onClick={copyCode}><Copy size={16} /> {copied ? 'Código copiado' : 'Copiar acceso'}</button>
          <button className="btn btn-ghost btn-full" onClick={() => { clearRelayIdentity(); setIdentity(null); setMessages([]); }}><LogOut size={16} /> Salir de este dispositivo</button>
        </div>
      </aside>

      <section className="web-chat-main">
        <header className="web-chat-header">
          <div><h1>Mi espacio web</h1><p>Disponible desde cualquier navegador con tu código privado</p></div>
          <Link className="btn btn-secondary btn-sm" to="/">misil.app</Link>
        </header>
        <div className="web-security-strip"><LockKeyhole size={14} /> Cifrado en este navegador · archivos bloqueados en la versión web</div>
        <div className="web-message-list" aria-live="polite">
          {messages.length === 0 ? (
            <div className="web-empty-chat"><BrandLogo size={64} color="var(--text-muted)" /><h2>Tu espacio está listo</h2><p>Comparte el código privado con otro dispositivo para continuar aquí la conversación.</p></div>
          ) : messages.map((message) => {
            const own = message.user_id === identity.deviceId;
            return (
              <article key={message.id} className={`web-message ${own ? 'own' : ''}`}>
                {!own && <span className="web-message-sender">{message.profile?.display_name || 'Usuario'}</span>}
                <p>{message.content}</p>
                <time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              </article>
            );
          })}
        </div>
        {error && <div className="web-chat-error">{error}</div>}
        <form className="web-composer" onSubmit={handleSend}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} placeholder="Escribe un mensaje" rows={1} maxLength={4000} />
          <button className="send-btn" disabled={!draft.trim() || busy} aria-label="Enviar mensaje"><Send size={18} /></button>
        </form>
      </section>
    </main>
  );
}
