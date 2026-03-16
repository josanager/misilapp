import { useState, FormEvent } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { X } from 'lucide-react';

interface CreateGroupModalProps {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const { createGroup, error } = useGroupStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const group = await createGroup(name, description, isPublic);
    setLoading(false);
    if (group) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crear grupo</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>Nombre del grupo</label>
              <input
                className="form-input"
                placeholder="Ej: Comunidad Latina"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <input
                className="form-input"
                placeholder="¿De qué trata este grupo?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="settings-item">
              <div className="settings-item-label">
                <span>Grupo público</span>
                <small>Los usuarios pueden buscar y solicitar unirse</small>
              </div>
              <div
                className={`toggle ${isPublic ? 'active' : ''}`}
                onClick={() => setIsPublic(!isPublic)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Creando...' : 'Crear grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
