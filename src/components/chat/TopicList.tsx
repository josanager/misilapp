import { useState } from 'react';
import { Hash, Plus, ChevronRight, Users } from 'lucide-react';
import { CreateTopicModal } from '../topics/CreateTopicModal';
import type { Topic } from '../../types';

interface TopicListProps {
  groupId: string;
  topics: Topic[];
  onSelectTopic: (topic: Topic) => void;
}

export function TopicList({ groupId, topics, onSelectTopic }: TopicListProps) {
  const [showCreateTopic, setShowCreateTopic] = useState(false);

  return (
    <div className="topic-list-container">
      <div className="topic-list-header">
        <h3>Temas del grupo</h3>
        <button
          className="topic-list-add-btn"
          onClick={() => setShowCreateTopic(true)}
        >
          <Plus size={16} />
          <span>Nuevo tema</span>
        </button>
      </div>

      {topics.length === 0 ? (
        <div className="topic-list-empty">
          <Users size={32} style={{ opacity: 0.4 }} />
          <p>No hay temas creados aún</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateTopic(true)}
          >
            Crear primer tema
          </button>
        </div>
      ) : (
        <div className="topic-list-items">
          {topics.map(topic => (
            <button
              key={topic.id}
              className="topic-list-item"
              onClick={() => onSelectTopic(topic)}
            >
              <div className="topic-list-item-icon">
                <Hash size={18} />
              </div>
              <div className="topic-list-item-info">
                <span className="topic-list-item-name">{topic.name}</span>
                {topic.description && (
                  <span className="topic-list-item-desc">{topic.description}</span>
                )}
              </div>
              <ChevronRight size={16} className="topic-list-item-chevron" />
            </button>
          ))}
        </div>
      )}

      {showCreateTopic && (
        <CreateTopicModal
          groupId={groupId}
          onClose={() => setShowCreateTopic(false)}
        />
      )}
    </div>
  );
}
