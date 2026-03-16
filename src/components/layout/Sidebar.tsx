import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { Settings, Search, Plus, LogOut, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { CreateGroupModal } from '../groups/CreateGroupModal';
import { SearchGroupModal } from '../groups/SearchGroupModal';
import type { Profile, Group } from '../../types';

interface SidebarProps {
  groups: Group[];
  currentGroup: Group | null;
  user: Profile;
  onSelectGroup: (group: Group) => void;
  onOpenSettings: () => void;
  visible: boolean;
  onToggle: () => void;
}

export function Sidebar({ groups, currentGroup, user, onSelectGroup, onOpenSettings, visible, onToggle }: SidebarProps) {
  const { logout } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(filter.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <aside className={`sidebar ${!visible ? 'hidden' : ''}`}>
        <div className="sidebar-header">
          <button 
            className="btn-icon mobile-sidebar-toggle" 
            onClick={onToggle}
          >
            {visible ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h2 className="hide-on-mobile">Chat Latino</h2>
          <button className="btn-icon" onClick={() => setShowSearchModal(true)} title="Buscar grupos">
            <Search size={20} />
          </button>
          {user.can_create_groups && (
            <button className="btn-icon" onClick={() => setShowCreateModal(true)} title="Crear grupo">
              <Plus size={20} />
            </button>
          )}
        </div>

        <div className="search-bar">
          <input
            className="search-input"
            placeholder=""
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="sidebar-content">
          <ul className="group-list">
            {filteredGroups.map(group => (
              <li
                key={group.id}
                className={`group-item ${currentGroup?.id === group.id ? 'active' : ''}`}
                onClick={() => onSelectGroup(group)}
              >
                <div className="group-avatar">
                  {getInitials(group.name)}
                </div>
                <div className="group-info">
                  <div className="group-name">{group.name}</div>
                  <div className="group-preview">{group.description || 'Sin descripción'}</div>
                </div>
              </li>
            ))}
            {filteredGroups.length === 0 && (
              <div className="empty-state" style={{ padding: '48px 24px' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {filter ? 'No se encontraron grupos' : 'No tienes grupos aún. ¡Crea uno!'}
                </p>
              </div>
            )}
          </ul>
        </div>

        <div className="user-profile-bar" onClick={onOpenSettings}>
          <div className="group-avatar">
            {getInitials(user.display_name || user.username)}
          </div>
          <div className="group-info" style={{ flex: 1 }}>
            <div className="group-name">{user.display_name || user.username}</div>
            <div className="group-preview hide-on-mobile">@{user.username}</div>
          </div>
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onOpenSettings(); }} title="Configuración">
            <Settings size={18} />
          </button>
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); logout(); }} title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} />
      )}
      {showSearchModal && (
        <SearchGroupModal onClose={() => setShowSearchModal(false)} onJoined={() => { setShowSearchModal(false); useGroupStore.getState().fetchMyGroups(); }} />
      )}
    </>
  );
}
