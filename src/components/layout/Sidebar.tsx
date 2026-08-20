import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { CreateGroupModal } from '../groups/CreateGroupModal';
import { getUserColor } from '../../lib/avatar';
import { BrandLogo } from '../common/BrandLogo';
import type { Group } from '../../types';

interface SidebarProps {
  groups: Group[];
  currentGroup: Group | null;
  onSelectGroup: (group: Group) => void;
  visible: boolean;
  onToggle: () => void;
}

export function Sidebar({ groups, currentGroup, onSelectGroup, visible }: SidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('');

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <aside className={`sidebar ${!visible ? 'hidden' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandLogo size={24} />
            <h2>Misil</h2>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }} title="Crear grupo">
            <Plus size={22} />
          </button>
        </div>

        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            className="search-input"
            placeholder=""
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="sidebar-content">
          <ul className="group-list">
            {/* Joined groups */}
            {groups.filter(g => g.name.toLowerCase().includes(filter.toLowerCase())).map(group => (
              <li
                key={group.id}
                className={`group-item ${currentGroup?.id === group.id ? 'active' : ''}`}
                onClick={() => onSelectGroup(group)}
              >
                <div className="group-avatar" style={{ background: getUserColor(group.id) }}>
                  {getInitials(group.name)}
                </div>
                <div className="group-info">
                  <div className="group-name">{group.name}</div>
                  <div className="group-preview">{group.description || 'Sin descripción'}</div>
                </div>
              </li>
            ))}

            {groups.filter(g => g.name.toLowerCase().includes(filter.toLowerCase())).length === 0 && (
              <div className="empty-state" style={{ padding: '48px 24px' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {filter ? 'No se encontraron grupos' : 'No tienes grupos aún. ¡Crea uno!'}
                </p>
              </div>
            )}
          </ul>
        </div>


      </aside>

      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
}
