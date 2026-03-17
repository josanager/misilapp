import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useChatStore } from '../../stores/chatStore';
import { Sidebar } from '../layout/Sidebar';
import { ChatView } from '../chat/ChatView';
import { SettingsPage } from '../settings/SettingsPage';
import { GroupPanel } from '../groups/GroupPanel';
import { supabase } from '../../lib/supabase';
import type { Group, Topic } from '../../types';

type View = 'chat' | 'settings';

export function MainLayout() {
  const { user } = useAuthStore();
  const { groups, currentGroup, topics, fetchMyGroups, fetchGroup, fetchTopics, setCurrentGroup } = useGroupStore();
  const { setCurrentTopic, currentTopicId } = useChatStore();
  const [view, setView] = useState<View>('chat');
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups]);

  // Handle browser back button on mobile
  useEffect(() => {
    const handlePopState = () => {
      if (window.innerWidth <= 768) {
        // If we were in a chat/settings, and user hits back, go back to group list
        setShowSidebar(true);
        setCurrentGroup(null);
        setView('chat');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentGroup]);

  const handleSelectGroup = useCallback(async (group: Group) => {
    setCurrentGroup(group);
    await fetchGroup(group.id);
    await fetchTopics(group.id);
    setView('chat');
    // On mobile, hide sidebar when group is selected and push history state
    if (window.innerWidth <= 768) {
      setShowSidebar(false);
      window.history.pushState({ view: 'chat', groupId: group.id }, '');
    }
  }, [fetchGroup, fetchTopics, setCurrentGroup]);

  // Handle join links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    
    if (joinId && user) {
      const handleJoin = async () => {
        const { joinGroup, groups } = useGroupStore.getState();
        const existing = groups.find(g => g.id === joinId);
        
        if (existing) {
          handleSelectGroup(existing);
          window.history.replaceState({}, '', '/');
          return;
        }

        const result = await joinGroup(joinId);
        if (result === 'joined') {
          const { data: group } = await supabase
            .from('groups')
            .select('*')
            .eq('id', joinId)
            .single();
          if (group) handleSelectGroup(group);
        } else if (result === 'requested') {
          setToastMsg('Solicitud de unión enviada. Espera a que un administrador te apruebe.');
        } else {
          setToastMsg('No se pudo encontrar el grupo o hubo un error al unirse.');
        }
        
        window.history.replaceState({}, '', '/');
      };

      handleJoin();
    }
  }, [user, handleSelectGroup]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const handleSelectTopic = useCallback((topic: Topic) => {
    setCurrentTopic(topic.id);
  }, [setCurrentTopic]);

  // Auto-select first topic when topics load
  useEffect(() => {
    if (topics.length > 0 && !currentTopicId) {
      setCurrentTopic(topics[0].id);
    }
  }, [topics, currentTopicId, setCurrentTopic]);

  if (!user) return null;

  return (
    <div className="app-layout">
      <Sidebar
        groups={groups}
        currentGroup={currentGroup}
        user={user}
        onSelectGroup={handleSelectGroup}
        onOpenSettings={() => { 
          setView('settings'); 
          setCurrentGroup(null);
          if (window.innerWidth <= 768) {
            setShowSidebar(false);
            window.history.pushState({ view: 'settings' }, '');
          }
        }}
        visible={showSidebar}
        onToggle={() => setShowSidebar(!showSidebar)}
      />

      <div className="main-area">
        {view === 'settings' ? (
          <SettingsPage onBack={() => {
            setView('chat');
            if (window.innerWidth <= 768) {
              setShowSidebar(true);
            }
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

      {toastMsg && (
        <div className="toast-container">
          <div className="toast info">{toastMsg}</div>
        </div>
      )}
    </div>
  );
}
