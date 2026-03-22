import { useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useChatStore } from '../../stores/chatStore';
import { Sidebar } from './Sidebar';
import { ChatView } from '../chat/ChatView';
import { SettingsPage } from '../settings/SettingsPage';
import { ProfilePage } from '../settings/ProfilePage';
import { GroupPanel } from '../groups/GroupPanel';
import { FloatingNavbar, MainTab } from './FloatingNavbar';
import { BrandLogo } from '../common/BrandLogo';
import type { Group, Topic } from '../../types';

export function DesktopLayout() {
  const { user } = useAuthStore();
  const { groups, currentGroup, topics, fetchGroup, fetchTopics, setCurrentGroup } = useGroupStore();
  const { setCurrentTopic, currentTopicId } = useChatStore();
  const [mainTab, setMainTab] = useState<MainTab>('chat');
  const [showGroupPanel, setShowGroupPanel] = useState(false);

  const handleSelectGroup = useCallback((group: Group) => {
    setCurrentGroup(group);
    setCurrentTopic(null);
    setMainTab('chat');

    fetchGroup(group.id);
    fetchTopics(group.id);
  }, [fetchGroup, fetchTopics, setCurrentGroup, setCurrentTopic]);

  const handleSelectTopic = useCallback((topic: Topic) => {
    setCurrentTopic(topic.id);
  }, [setCurrentTopic]);

  if (!user) return null;

  return (
    <div className="app-layout">
      {/* Sidebar visible only when mainTab is chat */}
      <Sidebar
        groups={groups}
        currentGroup={currentGroup}
        onSelectGroup={handleSelectGroup}
        visible={mainTab === 'chat'}
        onToggle={() => {}}
      />

      <div className="main-area">
        {mainTab === 'profile' ? (
          <ProfilePage />
        ) : mainTab === 'settings' ? (
          <SettingsPage onBack={() => setMainTab('chat')} />
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
              <BrandLogo size={120} color="var(--text-muted)" style={{ marginBottom: 'var(--space-lg)', opacity: 0.6 }} />
              <p>Selecciona un grupo para empezar a chatear o crea uno nuevo</p>
            </div>
          </div>
        )}
      </div>

      {showGroupPanel && currentGroup && mainTab === 'chat' && (
        <GroupPanel
          group={currentGroup}
          onClose={() => setShowGroupPanel(false)}
        />
      )}

      {/* Navbar constrained to sidebar width on desktop */}
      <FloatingNavbar currentTab={mainTab} onChangeTab={setMainTab} />
    </div>
  );
}
