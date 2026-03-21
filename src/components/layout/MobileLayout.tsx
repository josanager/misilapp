import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useChatStore } from '../../stores/chatStore';
import { Sidebar } from './Sidebar';
import { ChatView } from '../chat/ChatView';
import { SettingsPage } from '../settings/SettingsPage';
import { ProfilePage } from '../settings/ProfilePage';
import { GroupPanel } from '../groups/GroupPanel';
import { FloatingNavbar, MainTab } from './FloatingNavbar';
import type { Group, Topic } from '../../types';

export function MobileLayout() {
  const { user } = useAuthStore();
  const { groups, currentGroup, topics, fetchGroup, fetchTopics, setCurrentGroup } = useGroupStore();
  const { setCurrentTopic, currentTopicId } = useChatStore();
  const [mainTab, setMainTab] = useState<MainTab>('chat');
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Handle browser back button on mobile
  useEffect(() => {
    const handlePopState = () => {
      setShowSidebar(true);
      setCurrentGroup(null);
      setMainTab('chat');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentGroup]);

  const handleSelectGroup = useCallback((group: Group) => {
    setCurrentGroup(group);
    setCurrentTopic(null);
    setMainTab('chat');

    setShowSidebar(false);
    window.history.pushState({ view: 'chat', groupId: group.id }, '');

    fetchGroup(group.id);
    fetchTopics(group.id);
  }, [fetchGroup, fetchTopics, setCurrentGroup, setCurrentTopic]);

  const handleSelectTopic = useCallback((topic: Topic) => {
    setCurrentTopic(topic.id);
    setShowGroupPanel(false); 
  }, [setCurrentTopic]);

  const handleChangeTab = (tab: MainTab) => {
    setMainTab(tab);
    if (tab === 'chat' && !currentGroup) {
      setShowSidebar(true);
    } else if (tab !== 'chat') {
      setShowSidebar(false);
    }
  };

  if (!user) return null;

  return (
    <div className="app-layout">
      {mainTab === 'chat' && showSidebar ? (
        <Sidebar
          groups={groups}
          currentGroup={currentGroup}
          onSelectGroup={handleSelectGroup}
          visible={true}
          onToggle={() => {}}
        />
      ) : (
        <div className="main-area" style={{ animation: 'slideInBounce 0.25s ease' }}>
          {mainTab === 'profile' ? (
            <ProfilePage />
          ) : mainTab === 'settings' ? (
            <SettingsPage onBack={() => {
              setMainTab('chat');
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

      {showGroupPanel && currentGroup && mainTab === 'chat' && (
        <GroupPanel
          group={currentGroup}
          onClose={() => setShowGroupPanel(false)}
        />
      )}

      {/* Hide navbar on mobile when inside a chat view */}
      {!(mainTab === 'chat' && !showSidebar) && (
        <FloatingNavbar currentTab={mainTab} onChangeTab={handleChangeTab} />
      )}
    </div>
  );
}
