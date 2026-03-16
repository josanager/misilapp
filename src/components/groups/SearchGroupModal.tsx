import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { X, Search, UserPlus, Check } from 'lucide-react';

interface SearchGroupModalProps {
  onClose: () => void;
  onJoined: () => void;
}

export function SearchGroupModal({ onClose, onJoined: _onJoined }: SearchGroupModalProps) {
  const [query, setQuery] = useState('');
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const { searchResults, searchGroups, requestJoin } = useGroupStore();

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.length >= 2) {
      searchGroups(q);
    }
  };

  const handleJoinRequest = async (groupId: string) => {
    const success = await requestJoin(groupId);
    if (success) {
      setRequestedIds([...requestedIds, groupId]);
    }
  };

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Buscar grupos</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Buscar por nombre..."
              value={query}
              onChange={e => handleSearch(e.target.value)}
              autoFocus
            />
          </div>

          <ul className="search-results">
            {searchResults.map(group => (
              <li key={group.id} className="search-result-item">
                <div className="group-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
                  {getInitials(group.name)}
                </div>
                <div className="search-result-info">
                  <div className="search-result-name">{group.name}</div>
                  <div className="search-result-desc">{group.description || 'Sin descripción'}</div>
                </div>
                {requestedIds.includes(group.id) ? (
                  <span style={{ color: 'var(--accent-green)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={14} /> Enviada
                  </span>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleJoinRequest(group.id)}
                  >
                    <UserPlus size={14} /> Unirme
                  </button>
                )}
              </li>
            ))}
            {query.length >= 2 && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                No se encontraron grupos
              </div>
            )}
            {query.length < 2 && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                Escribe al menos 2 caracteres para buscar
              </div>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
