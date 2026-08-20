import { create } from 'zustand';
import { localApi } from '../services/localApi';
import type { Message, MessageReaction } from '../types';
import { useAuthStore } from './authStore';

interface ChatState {
  messagesByTopic: Record<string, Message[]>;
  messages: Message[];
  currentTopicId: string | null;
  loading: boolean;
  initialFetchDone: Record<string, boolean>;
  sending: boolean;
  replyTo: Message | null;
  typingUsers: string[];
  onlineUsers: string[];
  reactions: Record<string, MessageReaction[]>;
  fetchMessages: (topicId: string) => Promise<void>;
  sendMessage: (topicId: string, content: string, type?: string, fileUrl?: string, fileName?: string, fileSize?: number, mediaGroupId?: string, blobId?: string) => Promise<boolean>;
  retryMessage: (messageId: string) => Promise<boolean>;
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

function updateTopic(messagesByTopic: Record<string, Message[]>, topicId: string, messages: Message[]) {
  return { ...messagesByTopic, [topicId]: messages };
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByTopic: {},
  messages: [],
  currentTopicId: null,
  loading: false,
  initialFetchDone: {},
  sending: false,
  replyTo: null,
  typingUsers: [],
  onlineUsers: [],
  reactions: {},

  fetchMessages: async (topicId) => {
    const cached = get().messagesByTopic[topicId] || [];
    if (get().currentTopicId !== topicId) set({ currentTopicId: topicId, messages: cached, loading: !cached.length });
    try {
      const messages = (await localApi.messages(topicId)).map((message) => ({ ...message, status: 'sent' as const }));
      set((state) => ({
        messages: state.currentTopicId === topicId ? messages : state.messages,
        messagesByTopic: updateTopic(state.messagesByTopic, topicId, messages),
        initialFetchDone: { ...state.initialFetchDone, [topicId]: true },
        loading: false,
      }));
      if (messages.length) await get().fetchReactions(messages.map((message) => message.id));
    } catch { set({ loading: false }); }
  },

  sendMessage: async (topicId, content, type = 'text', fileUrl, fileName, fileSize, mediaGroupId, blobId) => {
    const user = useAuthStore.getState().user;
    if (!user) return false;
    const id = crypto.randomUUID();
    const replyTo = get().replyTo;
    const optimistic: Message = {
      id,
      topic_id: topicId,
      user_id: user.id,
      content,
      type: type as Message['type'],
      blob_id: blobId || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_size: fileSize || null,
      replied_to: replyTo?.id || null,
      media_group_id: mediaGroupId || null,
      created_at: new Date().toISOString(),
      profile: user,
      status: 'pending',
    };
    set((state) => {
      const messages = [...state.messages, optimistic];
      return { messages, messagesByTopic: updateTopic(state.messagesByTopic, topicId, messages), replyTo: null, sending: type !== 'text' };
    });
    try {
      const saved = await localApi.createMessage(optimistic);
      set((state) => {
        const messages = state.messages.map((message) => message.id === id ? { ...saved, status: 'sent' as const } : message);
        return { messages, messagesByTopic: updateTopic(state.messagesByTopic, topicId, messages), sending: false };
      });
      return true;
    } catch {
      set((state) => {
        const messages = state.messages.map((message) => message.id === id ? { ...message, status: 'error' as const } : message);
        return { messages, messagesByTopic: updateTopic(state.messagesByTopic, topicId, messages), sending: false };
      });
      return false;
    }
  },

  retryMessage: async (messageId) => {
    const message = get().messages.find((item) => item.id === messageId);
    if (!message || message.status !== 'error') return false;
    set((state) => ({ messages: state.messages.map((item) => item.id === messageId ? { ...item, status: 'pending' } : item) }));
    try {
      const saved = await localApi.createMessage(message);
      set((state) => {
        const messages = state.messages.map((item) => item.id === messageId ? { ...saved, status: 'sent' as const } : item);
        return { messages, messagesByTopic: updateTopic(state.messagesByTopic, message.topic_id, messages) };
      });
      return true;
    } catch {
      set((state) => ({ messages: state.messages.map((item) => item.id === messageId ? { ...item, status: 'error' } : item) }));
      return false;
    }
  },

  editMessage: async (messageId, newContent) => {
    try {
      const updated = await localApi.editMessage(messageId, newContent);
      set((state) => {
        const messages = state.messages.map((message) => message.id === messageId ? { ...updated, status: 'sent' as const } : message);
        return { messages, messagesByTopic: state.currentTopicId ? updateTopic(state.messagesByTopic, state.currentTopicId, messages) : state.messagesByTopic };
      });
      return true;
    } catch { return false; }
  },

  deleteMessage: async (messageId) => {
    const previous = get().messages;
    const target = previous.find((message) => message.id === messageId);
    if (!target) return false;
    const ids = target.media_group_id ? previous.filter((message) => message.media_group_id === target.media_group_id && message.user_id === target.user_id).map((message) => message.id) : [messageId];
    set((state) => {
      const messages = state.messages.filter((message) => !ids.includes(message.id));
      return { messages, messagesByTopic: state.currentTopicId ? updateTopic(state.messagesByTopic, state.currentTopicId, messages) : state.messagesByTopic };
    });
    try { await localApi.deleteMessage(messageId); return true; }
    catch {
      set((state) => ({ messages: previous, messagesByTopic: state.currentTopicId ? updateTopic(state.messagesByTopic, state.currentTopicId, previous) : state.messagesByTopic }));
      return false;
    }
  },

  setCurrentTopic: (topicId) => set({
    currentTopicId: topicId,
    messages: topicId ? get().messagesByTopic[topicId] || [] : [],
    reactions: {},
  }),
  setReplyTo: (replyTo) => set({ replyTo }),

  subscribeToMessages: (topicId) => {
    const interval = window.setInterval(() => {
      if (get().currentTopicId === topicId) void get().fetchMessages(topicId);
    }, 2500);
    return () => window.clearInterval(interval);
  },

  subscribeToPresence: () => {
    const user = useAuthStore.getState().user;
    set({ onlineUsers: user ? [user.id] : [] });
    return () => set({ onlineUsers: [] });
  },

  addMessage: (message) => {
    if (get().messages.some((item) => item.id === message.id)) return;
    set((state) => {
      const messages = [...state.messages, message];
      return { messages, messagesByTopic: state.currentTopicId ? updateTopic(state.messagesByTopic, state.currentTopicId, messages) : state.messagesByTopic };
    });
  },

  fetchReactions: async (messageIds) => {
    if (!messageIds.length) return;
    try {
      const rows = await localApi.reactions(messageIds);
      const grouped = { ...get().reactions };
      for (const id of messageIds) grouped[id] = [];
      for (const reaction of rows) (grouped[reaction.message_id] ||= []).push(reaction);
      set({ reactions: grouped });
    } catch { /* reactions are non-critical */ }
  },

  toggleReaction: async (messageId, emoji) => {
    try {
      const rows = await localApi.toggleReaction(messageId, emoji);
      set((state) => ({ reactions: { ...state.reactions, [messageId]: rows } }));
    } catch { /* no-op */ }
  },

  subscribeToReactions: () => () => undefined,
}));
