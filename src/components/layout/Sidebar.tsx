import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { Search, Plus, UserPlus, Check } from 'lucide-react';
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
  const { searchResults, searchGroups, joinGroup } = useGroupStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('');
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  const handleSearchChange = (val: string) => {
    setFilter(val);
    if (val.length >= 2) {
      searchGroups(val);
    }
  };

  const handleJoinAction = async (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    const result = await joinGroup(group.id);
    if (result === 'requested') {
      setRequestedIds([...requestedIds, group.id]);
    } else if (result === 'joined') {
      onSelectGroup(group);
      setFilter('');
    }
  };

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
            onChange={(e) => handleSearchChange(e.target.value)}
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

            {/* Global Search Results */}
            {filter.length >= 2 && searchResults.length > 0 && (
              <>
                <div className="search-divider" style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Descubrir grupos
                </div>
                {searchResults.map(group => (
                  <li key={group.id} className="group-item search-result">
                    <div className="group-avatar" style={{ opacity: 0.7, background: getUserColor(group.id) }}>
                      {getInitials(group.name)}
                    </div>
                    <div className="group-info">
                      <div className="group-name">{group.name}</div>
                      <div className="group-preview">{group.description || 'Sin descripción'}</div>
                    </div>
                    {requestedIds.includes(group.id) ? (
                      <Check size={16} style={{ color: 'var(--accent-green)', marginRight: 12 }} />
                    ) : (
                      <button 
                        className="btn-icon" 
                        style={{ marginRight: 8, color: 'var(--accent)' }}
                        onClick={(e) => handleJoinAction(e, group)}
                        title="Unirme"
                      >
                        <UserPlus size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </>
            )}

            {groups.filter(g => g.name.toLowerCase().includes(filter.toLowerCase())).length === 0 && searchResults.length === 0 && (
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
