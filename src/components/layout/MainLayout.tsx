import { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useChatStore } from '../../stores/chatStore';
import { MobileLayout } from './MobileLayout';
import { DesktopLayout } from './DesktopLayout';
import { useIsMobile } from '../../hooks/useIsMobile';

export function MainLayout() {
  const { user } = useAuthStore();
  const { fetchMyGroups } = useGroupStore();
  const { setCurrentTopic, currentTopicId } = useChatStore();
  const isMobile = useIsMobile(768);

  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups]);

  // Auto-select first topic when topics load
  const storeTopics = useGroupStore(state => state.topics);
  useEffect(() => {
    if (storeTopics.length > 0 && (!currentTopicId || !storeTopics.find(t => t.id === currentTopicId))) {
      // Seleccionar el primer grupo disponible de la lista (que por orden de la base de datos es el correcto, no obligamos 'General')
      setCurrentTopic(storeTopics[0].id);
    }
  }, [storeTopics, currentTopicId, setCurrentTopic]);

  if (!user) return null;

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}
