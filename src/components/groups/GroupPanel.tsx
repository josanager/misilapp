import { useEffect } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { X, Check, XCircle, Shield, Crown, User, Trash2, Image as ImageIcon, Link2, FileText, LayoutGrid, Settings as SettingsIcon } from 'lucide-react';
import type { Group } from '../../types';
import { useState } from 'react';

interface GroupPanelProps {
  group: Group;
  onClose: () => void;
}

export function GroupPanel({ group, onClose }: GroupPanelProps) {
  const { members, joinRequests, fetchMembers, fetchJoinRequests, handleJoinRequest, groupMedia, fetchGroupMedia, deleteGroup, setCurrentGroup, updateGroupSettings } = useGroupStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'members' | 'media' | 'links' | 'files' | 'settings'>('members');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Group settings state (fallback to true/unlimited if undefined)
  const [allowMessages, setAllowMessages] = useState(group.allow_messages ?? true);
  const [allowMedia, setAllowMedia] = useState(group.allow_media ?? true);
  const [allowLinks, setAllowLinks] = useState(group.allow_links ?? true);
  const [maxMembers, setMaxMembers] = useState<string>(group.max_members ? group.max_members.toString() : '');

  const [showMembersTab, setShowMembersTab] = useState(group.show_members ?? true);
  const [showMediaTab, setShowMediaTab] = useState(group.show_media ?? true);
  const [showLinksTab, setShowLinksTab] = useState(group.show_links ?? true);
  const [showFilesTab, setShowFilesTab] = useState(group.show_files ?? true);

  useEffect(() => {
    fetchMembers(group.id);
    fetchJoinRequests(group.id);
    fetchGroupMedia(group.id);
  }, [group.id, fetchMembers, fetchJoinRequests, fetchGroupMedia]);

  const isAdmin = members.find(m => m.user_id === user?.id)?.role === 'admin';
  const canDelete = user?.can_create_groups === true || group.created_by === user?.id;
  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown size={12} />;
      case 'moderator': return <Shield size={12} />;
      default: return <User size={12} />;
    }
  };

  return (
    <div className="group-panel">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-sm) var(--space-md)' }}>
        <button className="btn-icon" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="group-panel-header" style={{ position: 'relative' }}>
        {canDelete && (
          <button 
            className="btn-icon text-danger" 
            style={{ position: 'absolute', top: 0, right: 16 }}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            title="Eliminar grupo"
          >
            <Trash2 size={18} />
          </button>
        )}
        <div className="group-panel-avatar">
          {getInitials(group.name)}
        </div>
        <h3>{group.name}</h3>
        <p>{group.description || 'Sin descripción'}</p>
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          {group.is_public ? '🌐 Grupo público' : '🔒 Grupo privado'}
        </p>

        {(isAdmin || canDelete) && (
          <div style={{ position: 'relative', marginTop: 16 }}>
            <button 
              className="btn btn-secondary btn-sm btn-touch-feedback"
              style={{ gap: 8, width: '100%' }}
              onClick={() => {
                const url = `${window.location.origin}/?join=${group.id}`;
                navigator.clipboard.writeText(url);
                setShowCopied(true);
                setTimeout(() => setShowCopied(false), 2000);
              }}
            >
              <Link2 size={16} />
              Compartir enlace
            </button>
            {showCopied && (
              <div className="copied-toast">
                ¡Enlace copiado!
              </div>
            )}
          </div>
        )}
      </div>

      <div className="group-panel-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginTop: 16, padding: '0 16px' }}>
        {(isAdmin || group.show_members !== false) && (
          <button
            className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'members' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'members' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Miembros"
          >
            <User size={20} />
          </button>
        )}
        {(isAdmin || group.show_media !== false) && (
          <button
            className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'media' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'media' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Medios"
          >
            <ImageIcon size={20} />
          </button>
        )}
        {(isAdmin || group.show_links !== false) && (
          <button
            className={`tab-btn ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => setActiveTab('links')}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'links' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'links' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Enlaces"
          >
            <Link2 size={20} />
          </button>
        )}
        {(isAdmin || group.show_files !== false) && (
          <button
            className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'files' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'files' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Archivos"
          >
            <FileText size={20} />
          </button>
        )}
        {isAdmin && (
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'settings' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'settings' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Configuración"
          >
            <SettingsIcon size={20} />
          </button>
        )}
      </div>

      {activeTab === 'settings' && isAdmin && (
        <div className="settings-section" style={{ padding: '16px' }}>
          <h4 style={{ marginBottom: 20 }}>Permisos de miembros</h4>

          <div className="settings-item">
            <div className="settings-item-label">
              <div>
                <span>Enviar mensajes</span>
                <small>Permitir a los miembros enviar texto</small>
              </div>
            </div>
            <div
              className={`toggle ${allowMessages ? 'active' : ''}`}
              onClick={() => setAllowMessages(!allowMessages)}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <div>
                <span>Enviar contenido multimedia</span>
                <small>Fotos, videos y archivos</small>
              </div>
            </div>
            <div
              className={`toggle ${allowMedia ? 'active' : ''}`}
              onClick={() => setAllowMedia(!allowMedia)}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <div>
                <span>Permitir enlaces</span>
                <small>Ayuda a evitar el spam</small>
              </div>
            </div>
            <div
              className={`toggle ${allowLinks ? 'active' : ''}`}
              onClick={() => setAllowLinks(!allowLinks)}
            />
          </div>

          <h4 style={{ marginTop: 24, marginBottom: 16 }}>Límites del grupo</h4>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13 }}>Límite de miembros (dejar vacío para sin límite)</label>
            <input
              type="number"
              className="form-input"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              placeholder="Ej: 100"
              min={1}
            />
          </div>

          <h4 style={{ marginTop: 24, marginBottom: 16 }}>Visibilidad de pestañas (Ocultar a miembros)</h4>

          <div className="settings-item">
            <div className="settings-item-label">
              <div>
                <span>Mostrar miembros</span>
                <small>Permitir ver la lista de usuarios</small>
              </div>
            </div>
            <div
              className={`toggle ${showMembersTab ? 'active' : ''}`}
              onClick={() => setShowMembersTab(!showMembersTab)}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <div>
                <span>Mostrar medios</span>
                <small>Galería de fotos y videos</small>
              </div>
            </div>
            <div
              className={`toggle ${showMediaTab ? 'active' : ''}`}
              onClick={() => setShowMediaTab(!showMediaTab)}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <div>
                <span>Mostrar enlaces</span>
                <small>Historial de links compartidos</small>
              </div>
            </div>
            <div
              className={`toggle ${showLinksTab ? 'active' : ''}`}
              onClick={() => setShowLinksTab(!showLinksTab)}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-label">
              <div>
                <span>Mostrar archivos</span>
                <small>Documentos compartidos</small>
              </div>
            </div>
            <div
              className={`toggle ${showFilesTab ? 'active' : ''}`}
              onClick={() => setShowFilesTab(!showFilesTab)}
            />
          </div>

          <button
            className="btn btn-primary btn-full"
            disabled={isSavingSettings}
            onClick={async () => {
              setIsSavingSettings(true);
              const success = await updateGroupSettings(group.id, {
                allow_messages: allowMessages,
                allow_media: allowMedia,
                allow_links: allowLinks,
                max_members: maxMembers ? parseInt(maxMembers) : null,
                show_members: showMembersTab,
                show_media: showMediaTab,
                show_links: showLinksTab,
                show_files: showFilesTab
              });
              setIsSavingSettings(false);
              if (success) {
                alert('Ajustes guardados correctamente (asegúrate de que estas columnas existan en tu tabla de Supabase).');
              } else {
                alert('Error al guardar. Verifica que las nuevas columnas booleanas existan en la tabla groups.');
              }
            }}
          >
            {isSavingSettings ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      )}

      {activeTab === 'members' && (
        <>
          {/* Join Requests (admin only) */}
          {isAdmin && joinRequests.length > 0 && (
            <div className="settings-section">
              <h4>
                Solicitudes de unión
                <span className="badge" style={{ marginLeft: 8 }}>{joinRequests.length}</span>
              </h4>
              {joinRequests.map(req => (
                <div key={req.id} className="request-item">
                  <div className="member-avatar">
                    {getInitials(req.profile?.display_name || req.profile?.username || '?')}
                  </div>
                  <div className="member-info" style={{ flex: 1 }}>
                    <div className="member-name">{req.profile?.display_name || req.profile?.username}</div>
                    <div className="member-role">@{req.profile?.username}</div>
                  </div>
                  <div className="request-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleJoinRequest(req.id, true)}
                      title="Aprobar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleJoinRequest(req.id, false)}
                      title="Rechazar"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Members */}
          <div className="settings-section">
            <h4>Miembros ({members.length})</h4>
            <ul className="member-list">
              {members.map(member => {
                const profile = (member as any).profile;
                const name = profile?.display_name || profile?.username || 'Usuario';
                return (
                  <li key={member.user_id} className="member-item">
                    <div className="member-avatar">
                      {getInitials(name)}
                    </div>
                    <div className="member-info">
                      <div className="member-name">{name}</div>
                      <div className="member-role">@{profile?.username}</div>
                    </div>
                    <span className={`role-badge ${member.role}`}>
                      {getRoleIcon(member.role)} {member.role}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {activeTab === 'media' && (
        <div className="settings-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '16px' }}>
          {groupMedia.filter(m => m.type === 'image' || m.type === 'video').length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <LayoutGrid size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p>No hay fotos ni videos</p>
            </div>
          ) : (
            groupMedia.filter(m => m.type === 'image' || m.type === 'video').map(m => (
              <div key={m.id} style={{ aspectRatio: '1/1', background: 'var(--bg-secondary)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}>
                {m.type === 'image' ? (
                  <img src={m.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <video src={m.file_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'links' && (
        <div className="settings-section" style={{ padding: '8px 16px' }}>
          {groupMedia.filter(m => m.type === 'text' && m.content.includes('http')).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Link2 size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p>No hay enlaces compartidos</p>
            </div>
          ) : (
            groupMedia.filter(m => m.type === 'text' && m.content.includes('http')).map(m => {
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const urls = m.content.match(urlRegex) || [];
              return urls.map((url: string, i: number) => (
                <div key={`${m.id}-${i}`} className="member-item" style={{ alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <Link2 size={20} />
                  </div>
                  <div className="member-info" style={{ overflow: 'hidden' }}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="member-name" style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {url}
                    </a>
                    <div className="member-role">Enviado por {m.profile?.display_name || m.profile?.username}</div>
                  </div>
                </div>
              ));
            })
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div className="settings-section" style={{ padding: '8px 16px' }}>
          {groupMedia.filter(m => m.type === 'file').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <FileText size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p>No hay archivos compartidos</p>
            </div>
          ) : (
            groupMedia.filter(m => m.type === 'file').map(m => (
              <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="member-item" style={{ textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <FileText size={20} />
                </div>
                <div className="member-info" style={{ overflow: 'hidden' }}>
                  <div className="member-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.file_name || 'Archivo'}
                  </div>
                  <div className="member-role">
                    {m.file_size ? `${(m.file_size / 1024 / 1024).toFixed(1)} MB • ` : ''}
                    {m.profile?.display_name || m.profile?.username}
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar grupo</h3>
            </div>
            <div className="modal-body">
              <p>¿Estás seguro de que deseas eliminar este grupo? Esta acción no se puede deshacer y borrará todos los mensajes.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancelar</button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  setIsDeleting(true);
                  const success = await deleteGroup(group.id);
                  if (success) {
                    setCurrentGroup(null);
                    onClose();
                  }
                  setIsDeleting(false);
                  setShowDeleteConfirm(false);
                }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
