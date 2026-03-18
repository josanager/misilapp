import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, type Message, type MessageReaction } from '../lib/supabase';

interface ChatState {
  messagesByTopic: Record<string, Message[]>;
  messages: Message[];
  currentTopicId: string | null;
  loading: boolean;
  sending: boolean;
  replyTo: Message | null;
  typingUsers: string[];
  onlineUsers: string[];
  reactions: Record<string, MessageReaction[]>;
  fetchMessages: (topicId: string) => Promise<void>;
  sendMessage: (topicId: string, content: string, type?: string, fileUrl?: string, fileName?: string, fileSize?: number, mediaGroupId?: string) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  setCurrentTopic: (topicId: string | null) => void;
  setReplyTo: (message: Message | null) => void;
  subscribeToMessages: (topicId: string) => () => void;
  subscribeToPresence: (groupId: string) => () => void;
  addMessage: (message: Message) => void;
  fetchReactions: (messageIds: string[]) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  subscribeToReactions: (topicId: string) => () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
  messagesByTopic: {},
  messages: [],
  currentTopicId: null,
  loading: false,
  sending: false,
  replyTo: null,
  typingUsers: [],
  onlineUsers: [],
  reactions: {},

  fetchMessages: async (topicId: string) => {
    // Si tenemos mensajes en caché para este tema, los mostramos instantáneamente
    const cachedMessages = get().messagesByTopic[topicId] || [];

    // Solo mostramos un pequeño parpadeo si no hay nada en caché
    if (get().currentTopicId !== topicId) {
      set({
        currentTopicId: topicId,
        messages: cachedMessages,
        loading: cachedMessages.length === 0
      });
    }

    try {
      const { data } = await supabase
        .from('messages')
        .select('*, profile:profiles(*)')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true })
        .limit(100);

      const newMessages = data || [];

      set(state => ({
        messages: newMessages,
        loading: false,
        messagesByTopic: {
          ...state.messagesByTopic,
          [topicId]: newMessages
        }
      }));

      // Fetch reactions for all loaded messages en background
      if (newMessages.length > 0) {
        get().fetchReactions(newMessages.map(m => m.id));
      }
    } catch (e) {
      set({ loading: false });
    }
  },

  sendMessage: async (topicId: string, content: string, type = 'text', fileUrl?: string, fileName?: string, fileSize?: number, mediaGroupId?: string) => {
    const isMedia = type !== 'text';
    if (isMedia) {
      set({ sending: true });
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { replyTo, messages } = get();
      
      // OPTIMISTIC UPDATE: Use a real UUID instead of a temporary ID
      // This prevents React from unmounting and remounting the DOM node when the ID changes
      const finalId = crypto.randomUUID();

      // Intentar obtener el perfil real de authStore si está disponible para evitar el glitch de "..."
      let userProfile = { username: 'Usuario', display_name: 'Usuario' };
      try {
        const { useAuthStore } = await import('./authStore');
        const authUser = useAuthStore.getState().user;
        if (authUser) {
          userProfile = { username: authUser.username, display_name: authUser.display_name || authUser.username };
        }
      } catch (e) {
        // Fallback silently if circular dependency or error
      }

      const optimisticMessage: Message = {
        id: finalId,
        topic_id: topicId,
        user_id: user.id,
        content,
        type: type as 'text' | 'image' | 'video' | 'file',
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        replied_to: replyTo?.id || null,
        media_group_id: mediaGroupId || null,
        created_at: new Date().toISOString(),
        profile: userProfile as any,
      };

      // Add to UI immediately
      const updatedMessages = [...messages, optimisticMessage];
      set(state => ({
        messages: updatedMessages,
        messagesByTopic: {
          ...state.messagesByTopic,
          [topicId]: updatedMessages
        },
        replyTo: null 
      }));

      // Insert real into database using the exact same ID
      const { data, error } = await supabase.from('messages').insert({
        id: finalId,
        topic_id: topicId,
        user_id: user.id,
        content,
        type,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        replied_to: replyTo?.id || null,
        media_group_id: mediaGroupId || null,
      }).select('*, profile:profiles(*)').single();

      if (isMedia) {
        set({ sending: false });
      }

      if (error) {
        // Revert on failure
        set(state => {
          const reverted = state.messages.filter(m => m.id !== finalId);
          return {
            messages: reverted,
            messagesByTopic: {
              ...state.messagesByTopic,
              [topicId]: reverted
            }
          };
        });
        return false;
      }
      
      if (data) {
        // Solo actualizamos de manera silenciosa si las propiedades clave (como id o timestamp) difieren,
        // para minimizar aún más los re-renders innecesarios.
        set(state => {
          const finalMessages = state.messages.map(m => m.id === finalId ? { ...m, ...data } : m);
          return {
            messages: finalMessages,
            messagesByTopic: {
              ...state.messagesByTopic,
              [topicId]: finalMessages
            }
          };
        });
      }

      return true;
    } catch {
      if (isMedia) set({ sending: false });
      return false;
    }
  },

  editMessage: async (messageId: string, newContent: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: newContent, is_edited: true })
        .eq('id', messageId);

      if (error) throw error;
      
      // Update local state immediately for better UX
      set(state => {
        const newMessages = state.messages.map(m =>
          m.id === messageId ? { ...m, content: newContent, is_edited: true } : m
        );
        const topicId = state.currentTopicId;
        return {
          messages: newMessages,
          messagesByTopic: topicId ? { ...state.messagesByTopic, [topicId]: newMessages } : state.messagesByTopic
        };
      });
      
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      return false;
    }
  },

  deleteMessage: async (messageId: string) => {
    try {
      // 1. Optimistic Update: Immediately remove message from UI to feel blazing fast
      // But we need to remember the state in case it fails and we need to revert
      const prevState = get().messages;

      // First find if this message belongs to a media group locally
      const msgToDeleteLocal = prevState.find(m => m.id === messageId);
      if (!msgToDeleteLocal) return false;

      let localIdsToRemove = [messageId];
      if (msgToDeleteLocal.media_group_id) {
        localIdsToRemove = prevState
          .filter(m => m.media_group_id === msgToDeleteLocal.media_group_id && m.user_id === msgToDeleteLocal.user_id)
          .map(m => m.id);
      }

      set(state => {
        const filtered = state.messages.filter(m => !localIdsToRemove.includes(m.id));
        const topicId = state.currentTopicId;
        return {
          messages: filtered,
          messagesByTopic: topicId ? { ...state.messagesByTopic, [topicId]: filtered } : state.messagesByTopic
        };
      });

      // 2. Fetch the message from DB to make sure we clean up files properly
      const { data: msg } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
        
      if (!msg) {
        // If it wasn't in DB (e.g. temporary message), we are already done
        return true;
      }

      // 3. Determine all DB messages to delete (media group logic)
      let messagesToDelete = [msg];
      if (msg.media_group_id) {
        const { data: groupMsgs } = await supabase
          .from('messages')
          .select('*')
          .eq('media_group_id', msg.media_group_id)
          .eq('user_id', msg.user_id);
          
        if (groupMsgs) {
          messagesToDelete = groupMsgs;
        }
      }

      const dbMessageIds = messagesToDelete.map(m => m.id);

      // 4. Delete the database records FIRST so it syncs to other clients faster
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', dbMessageIds);

      if (error) {
        console.error('❌ Supabase delete error:', error);
        // Revert optimistic update
        set(state => {
          const topicId = state.currentTopicId;
          return {
            messages: prevState,
            messagesByTopic: topicId ? { ...state.messagesByTopic, [topicId]: prevState } : state.messagesByTopic
          };
        });
        return false;
      }

      // 5. Delete files from R2 in the background (fire and forget to not block UI)
      const workerUrl = import.meta.env.VITE_UPLOAD_WORKER_URL || 'http://localhost:8787';
      const { data: { session } } = await supabase.auth.getSession();
      
      Promise.all(messagesToDelete.map(async (m) => {
        if (m.file_url) {
          const key = m.file_url.split('/').pop();
          if (key) {
            try {
              const response = await fetch(`${workerUrl}/delete-file`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': session ? `Bearer ${session.access_token}` : '',
                },
                body: JSON.stringify({ fileName: key }),
              });
              if (!response.ok) console.warn(`⚠️ Worker failed to delete ${key}`);
            } catch (err) {
              console.error('❌ Failed to delete file from R2:', err);
            }
          }
        }
      })).catch(console.error);

      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  },

  setCurrentTopic: (topicId) => {
    if (!topicId) {
      set({ currentTopicId: null, messages: [], reactions: {} });
      return;
    }
    // Carga instantánea desde caché si existe
    const cached = get().messagesByTopic[topicId] || [];
    set({ currentTopicId: topicId, messages: cached, reactions: {} });
  },

  setReplyTo: (message) => set({ replyTo: message }),

  subscribeToMessages: (topicId: string) => {
    const channel = supabase
      .channel(`messages:${topicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `topic_id=eq.${topicId}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Fetch the full message with profile
          const { data } = await supabase
            .from('messages')
            .select('*, profile:profiles(*)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const { messages } = get();
            if (!messages.find(m => m.id === data.id)) {
              set(state => {
                const newMsgs = [...state.messages, data];
                return {
                  messages: newMsgs,
                  messagesByTopic: { ...state.messagesByTopic, [topicId]: newMsgs }
                };
              });
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          set((state) => {
            const newMsgs = state.messages.map((m) => m.id === payload.new.id ? { ...m, ...payload.new } : m);
            return {
              messages: newMsgs,
              messagesByTopic: { ...state.messagesByTopic, [topicId]: newMsgs }
            };
          });
        } else if (payload.eventType === 'DELETE') {
          set((state) => {
            const newMsgs = state.messages.filter((m) => m.id !== payload.old.id);
            return {
              messages: newMsgs,
              messagesByTopic: { ...state.messagesByTopic, [topicId]: newMsgs }
            };
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToPresence: (groupId: string) => {
    const channel = supabase.channel(`presence:${groupId}`, {
      config: { presence: { key: 'user_id' } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = Object.keys(state);
        set({ onlineUsers: online });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },

  addMessage: (message: Message) => {
    const { messages } = get();
    if (!messages.find(m => m.id === message.id)) {
      set(state => {
        const newMsgs = [...state.messages, message];
        const topicId = state.currentTopicId;
        return {
          messages: newMsgs,
          messagesByTopic: topicId ? { ...state.messagesByTopic, [topicId]: newMsgs } : state.messagesByTopic
        };
      });
    }
  },

  fetchReactions: async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const { data } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messageIds);

    if (data) {
      const grouped: Record<string, MessageReaction[]> = { ...get().reactions };
      // Clear existing for these message IDs
      messageIds.forEach(id => { grouped[id] = []; });
      data.forEach(r => {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push(r);
      });
      set({ reactions: grouped });
    }
  },

  toggleReaction: async (messageId: string, emoji: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { reactions } = get();
    const msgReactions = reactions[messageId] || [];
    const existing = msgReactions.find(r => r.emoji === emoji && r.user_id === user.id);

    if (existing) {
      // Remove reaction
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      const updated = { ...reactions };
      updated[messageId] = msgReactions.filter(r => r.id !== existing.id);
      set({ reactions: updated });
    } else {
      // Add reaction
      const { data, error } = await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      }).select().single();

      if (data && !error) {
        const updated = { ...reactions };
        updated[messageId] = [...(updated[messageId] || []), data];
        set({ reactions: updated });
      }
    }
  },

  subscribeToReactions: (topicId: string) => {
    // Subscribe to reaction changes for messages in this topic
    const channel = supabase
      .channel(`reactions:${topicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, async (payload) => {
        const msgId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
        if (msgId) {
          // Check if this message is in our current list
          const { messages } = get();
          if (messages.find(m => m.id === msgId)) {
            get().fetchReactions([msgId]);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
    }),
    {
      name: 'chat-latino-messages-storage',
      // Solo persistimos el caché de mensajes. Dejamos currentTopicId y messages limpios
      // para que cada vez que se inicie la sesión comience de cero
      partialize: (state) => ({ messagesByTopic: state.messagesByTopic }),
    }
  )
);

