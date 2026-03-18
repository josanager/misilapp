import { useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useChatStore } from '../../stores/chatStore';
import { Sidebar } from './Sidebar';
import { ChatView } from '../chat/ChatView';
import { SettingsPage } from '../settings/SettingsPage';
import { GroupPanel } from '../groups/GroupPanel';
import type { Group, Topic } from '../../types';

type View = 'chat' | 'settings';

export function DesktopLayout() {
  const { user } = useAuthStore();
  const { groups, currentGroup, topics, fetchGroup, fetchTopics, setCurrentGroup } = useGroupStore();
  const { setCurrentTopic, currentTopicId } = useChatStore();
  const [view, setView] = useState<View>('chat');
  const [showGroupPanel, setShowGroupPanel] = useState(false);

  const handleSelectGroup = useCallback((group: Group) => {
    setCurrentGroup(group);
    setCurrentTopic(null); // Se auto-seleccionará el primero al cargar los topics en MainLayout
    setView('chat');

    fetchGroup(group.id);
    fetchTopics(group.id);
  }, [fetchGroup, fetchTopics, setCurrentGroup, setCurrentTopic]);

  const handleSelectTopic = useCallback((topic: Topic) => {
    setCurrentTopic(topic.id);
  }, [setCurrentTopic]);

  if (!user) return null;

  return (
    <div className="app-layout">
      {/* Sidebar siempre visible en Desktop */}
      <Sidebar
        groups={groups}
        currentGroup={currentGroup}
        user={user}
        onSelectGroup={handleSelectGroup}
        onOpenSettings={() => {
          setView('settings');
          setCurrentGroup(null);
        }}
        visible={true}
        onToggle={() => {}}
      />

      <div className="main-area">
        {view === 'settings' ? (
          <SettingsPage onBack={() => setView('chat')} />
        ) : currentGroup ? (
          <ChatView
            group={currentGroup}
            topics={topics}
            currentTopicId={currentTopicId}
            onSelectTopic={handleSelectTopic}
            onToggleGroupPanel={() => setShowGroupPanel(!showGroupPanel)}
            onShowSidebar={() => {}}
          />
        ) : (
          <div className="empty-state hide-on-mobile">
            <div className="empty-state-content">
              <div className="empty-state-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Chat Latino</h3>
              <p>Selecciona un grupo para empezar a chatear o crea uno nuevo</p>
            </div>
          </div>
        )}
      </div>

      {showGroupPanel && currentGroup && (
        <GroupPanel
          group={currentGroup}
          onClose={() => setShowGroupPanel(false)}
        />
      )}
    </div>
  );
}
