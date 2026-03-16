import { useState, FormEvent } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { X } from 'lucide-react';

interface CreateTopicModalProps {
  groupId: string;
  onClose: () => void;
}

export function CreateTopicModal({ groupId, onClose }: CreateTopicModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { createTopic } = useGroupStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const topic = await createTopic(groupId, name, description);
    setLoading(false);
    if (topic) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crear tema</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Nombre del tema</label>
              <input
                className="form-input"
                placeholder=""
                value={name}
                onChange={e => setName(e.target.value)}
                required
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Descripción (opcional)</label>
              <input
                className="form-input"
                placeholder=""
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Creando...' : 'Crear tema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
