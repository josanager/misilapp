import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { useChatStore } from '../../stores/chatStore';
import { MobileLayout } from './MobileLayout';
import { DesktopLayout } from './DesktopLayout';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from '../../lib/supabase';

export function MainLayout() {
  const { user } = useAuthStore();
  const { fetchMyGroups } = useGroupStore();
  const { setCurrentTopic, currentTopicId } = useChatStore();
  const isMobile = useIsMobile(768);

  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups]);

  // Handle join links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    
    if (joinId && user) {
      const handleJoin = async () => {
        const { joinGroup, groups, setCurrentGroup, fetchGroup, fetchTopics } = useGroupStore.getState();
        const { setCurrentTopic } = useChatStore.getState();

        const forceSelectGroup = (group: any) => {
          setCurrentGroup(group);
          setCurrentTopic(null);
          fetchGroup(group.id);
          fetchTopics(group.id);
        };

        const existing = groups.find(g => g.id === joinId);
        
        if (existing) {
          forceSelectGroup(existing);
          // Clean URL without reloading
          window.history.replaceState({}, '', '/');
          return;
        }

        // Show toast immediately so user knows it's doing something
        setToastMsg('Uniéndote al grupo...');

        const result = await joinGroup(joinId);
        if (result === 'joined') {
          // fetch group using standard approach
          const { data: group } = await supabase
            .from('groups')
            .select('*')
            .eq('id', joinId)
            .single();
          if (group) {
            forceSelectGroup(group);
            setToastMsg('¡Te has unido al grupo!');
          }
        } else if (result === 'requested') {
          setToastMsg('Solicitud de unión enviada. Espera a que un administrador te apruebe.');
        } else {
          setToastMsg('No se pudo encontrar el grupo o hubo un error al unirse.');
        }
      };

      handleJoin();
    }
  }, [user]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Auto-select first topic when topics load
  const storeTopics = useGroupStore(state => state.topics);
  useEffect(() => {
    if (storeTopics.length > 0 && (!currentTopicId || !storeTopics.find(t => t.id === currentTopicId))) {
      // Seleccionar el primer grupo disponible de la lista (que por orden de la base de datos es el correcto, no obligamos 'General')
      setCurrentTopic(storeTopics[0].id);
    }
  }, [storeTopics, currentTopicId, setCurrentTopic]);

  // Handle heartbeat for presence
  useEffect(() => {
    if (!user) return;

    // Initial heartbeat
    supabase
      .from('user_presence')
      .upsert({ user_id: user.id, status: 'online', last_seen: new Date().toISOString() })
      .then();

    const interval = setInterval(() => {
      supabase
        .from('user_presence')
        .upsert({ user_id: user.id, status: 'online', last_seen: new Date().toISOString() })
        .then();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <>
      {isMobile ? <MobileLayout /> : <DesktopLayout />}

      {toastMsg && (
        <div className="toast-container">
          <div className="toast info">{toastMsg}</div>
        </div>
      )}
    </>
  );
}
