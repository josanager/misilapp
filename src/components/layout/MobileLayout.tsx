import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useChatStore } from '../../stores/chatStore';
import { Sidebar } from './Sidebar';
import { ChatView } from '../chat/ChatView';
import { SettingsPage } from '../settings/SettingsPage';
import { GroupPanel } from '../groups/GroupPanel';
import type { Group, Topic } from '../../types';

type View = 'chat' | 'settings';

export function MobileLayout() {
  const { user } = useAuthStore();
  const { groups, currentGroup, topics, fetchGroup, fetchTopics, setCurrentGroup } = useGroupStore();
  const { setCurrentTopic, currentTopicId } = useChatStore();
  const [view, setView] = useState<View>('chat');
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true); // En móvil es excluyente

  // Handle browser back button on mobile
  useEffect(() => {
    const handlePopState = () => {
      setShowSidebar(true);
      setCurrentGroup(null);
      setView('chat');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentGroup]);

  const handleSelectGroup = useCallback((group: Group) => {
    setCurrentGroup(group);
    setCurrentTopic(null);
    setView('chat');

    // Ocultar sidebar y guardar historial para atrás
    setShowSidebar(false);
    window.history.pushState({ view: 'chat', groupId: group.id }, '');

    fetchGroup(group.id);
    fetchTopics(group.id);
  }, [fetchGroup, fetchTopics, setCurrentGroup, setCurrentTopic]);

  const handleSelectTopic = useCallback((topic: Topic) => {
    setCurrentTopic(topic.id);
    setShowGroupPanel(false); // Por si venía del panel de grupo
  }, [setCurrentTopic]);

  if (!user) return null;

  return (
    <div className="app-layout">
      {showSidebar ? (
        <Sidebar
          groups={groups}
          currentGroup={currentGroup}
          user={user}
          onSelectGroup={handleSelectGroup}
          onOpenSettings={() => {
            setView('settings');
            setCurrentGroup(null);
            setShowSidebar(false);
            window.history.pushState({ view: 'settings' }, '');
          }}
          visible={true}
          onToggle={() => {}}
        />
      ) : (
        <div className="main-area" style={{ animation: 'slideInBounce 0.25s ease' }}>
          {view === 'settings' ? (
            <SettingsPage onBack={() => {
              setView('chat');
              setShowSidebar(true);
            }} />
          ) : currentGroup ? (
            <ChatView
              group={currentGroup}
              topics={topics}
              currentTopicId={currentTopicId}
              onSelectTopic={handleSelectTopic}
              onToggleGroupPanel={() => setShowGroupPanel(!showGroupPanel)}
              onShowSidebar={() => setShowSidebar(true)}
            />
          ) : null}
        </div>
      )}

      {showGroupPanel && currentGroup && (
        <GroupPanel
          group={currentGroup}
          onClose={() => setShowGroupPanel(false)}
        />
      )}
    </div>
  );
}
