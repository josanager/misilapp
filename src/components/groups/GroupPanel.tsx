import { useEffect } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { X, Check, XCircle, Shield, Crown, User, Trash2, Image as ImageIcon, Link2, FileText, LayoutGrid } from 'lucide-react';
import type { Group } from '../../types';
import { useState } from 'react';

interface GroupPanelProps {
  group: Group;
  onClose: () => void;
}

export function GroupPanel({ group, onClose }: GroupPanelProps) {
  const { members, joinRequests, fetchMembers, fetchJoinRequests, handleJoinRequest, groupMedia, fetchGroupMedia, deleteGroup, setCurrentGroup } = useGroupStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'members' | 'media' | 'links' | 'files'>('members');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

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
            onClick={async () => {
              if (window.confirm('¿Estás seguro de que deseas eliminar este grupo? Esta acción no se puede deshacer y borrará todos los mensajes.')) {
                setIsDeleting(true);
                const success = await deleteGroup(group.id);
                if (success) {
                  setCurrentGroup(null);
                  onClose();
                }
                setIsDeleting(false);
              }
            }}
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
        <button 
          className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} 
          onClick={() => setActiveTab('members')}
          style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'members' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'members' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Miembros"
        >
          <User size={20} />
        </button>
        <button 
          className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`} 
          onClick={() => setActiveTab('media')}
          style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'media' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'media' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Medios"
        >
          <ImageIcon size={20} />
        </button>
        <button 
          className={`tab-btn ${activeTab === 'links' ? 'active' : ''}`} 
          onClick={() => setActiveTab('links')}
          style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'links' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'links' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Enlaces"
        >
          <Link2 size={20} />
        </button>
        <button 
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`} 
          onClick={() => setActiveTab('files')}
          style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'files' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'files' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Archivos"
        >
          <FileText size={20} />
        </button>
      </div>

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
    </div>
  );
}
