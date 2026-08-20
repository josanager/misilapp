import { create } from 'zustand';
import { localApi } from '../services/localApi';
import type { Group, GroupMember, JoinRequest, Message, Topic } from '../types';

export type MediaFilter = 'recent' | 'top_rated' | 'most_viewed';
export type MediaRatingInfo = { avg: number; count: number; userRating?: number };

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  members: GroupMember[];
  topics: Topic[];
  joinRequests: JoinRequest[];
  searchResults: Group[];
  groupMedia: Message[];
  mediaRatings: Record<string, MediaRatingInfo>;
  mediaFilter: MediaFilter;
  loading: boolean;
  error: string | null;
  fetchMyGroups: () => Promise<void>;
  fetchGroup: (groupId: string) => Promise<void>;
  fetchMembers: (groupId: string) => Promise<void>;
  fetchTopics: (groupId: string) => Promise<void>;
  fetchJoinRequests: (groupId: string) => Promise<void>;
  createGroup: (name: string, description: string, isPublic: boolean) => Promise<Group | null>;
  searchGroups: (query: string) => Promise<void>;
  requestJoin: (groupId: string) => Promise<boolean>;
  joinGroup: (groupId: string) => Promise<'joined' | 'requested' | 'error'>;
  handleJoinRequest: (requestId: string, approve: boolean) => Promise<boolean>;
  createTopic: (groupId: string, name: string, description: string) => Promise<Topic | null>;
  setCurrentGroup: (group: Group | null) => void;
  clearError: () => void;
  deleteGroup: (groupId: string) => Promise<boolean>;
  fetchGroupMedia: (groupId: string) => Promise<void>;
  updateGroupSettings: (groupId: string, settings: Partial<Group>) => Promise<boolean>;
  setMediaFilter: (filter: MediaFilter) => void;
  rateMedia: (messageId: string, rating: number) => Promise<void>;
  fetchMediaRatings: (messageIds: string[]) => Promise<void>;
  incrementViewCount: (messageId: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  currentGroup: null,
  members: [],
  topics: [],
  joinRequests: [],
  searchResults: [],
  groupMedia: [],
  mediaRatings: {},
  mediaFilter: 'recent',
  loading: false,
  error: null,

  fetchMyGroups: async () => {
    set({ loading: get().groups.length === 0 });
    try {
      const groups = await localApi.groups();
      set({ groups, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'No se pudieron cargar los espacios locales.' });
    }
  },

  fetchGroup: async (groupId) => {
    try { set({ currentGroup: await localApi.group(groupId) }); } catch { /* group may have been removed */ }
  },

  fetchMembers: async (groupId) => {
    try { set({ members: await localApi.members(groupId) }); } catch { set({ members: [] }); }
  },

  fetchTopics: async (groupId) => {
    try { set({ topics: await localApi.topics(groupId) }); } catch { set({ topics: [] }); }
  },

  fetchJoinRequests: async () => set({ joinRequests: [] }),

  createGroup: async (name, description, isPublic) => {
    try {
      const group = await localApi.createGroup(name, description, isPublic);
      set({ groups: [group, ...get().groups], error: null });
      return group;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo crear el espacio local.' });
      return null;
    }
  },

  searchGroups: async () => set({ searchResults: [] }),
  requestJoin: async () => false,
  joinGroup: async (groupId) => get().groups.some((group) => group.id === groupId) ? 'joined' : 'error',
  handleJoinRequest: async () => false,

  createTopic: async (groupId, name, description) => {
    try {
      const topic = await localApi.createTopic(groupId, name, description);
      set({ topics: [...get().topics, topic] });
      return topic;
    } catch { return null; }
  },

  setCurrentGroup: (group) => set({ currentGroup: group }),
  clearError: () => set({ error: null }),

  deleteGroup: async (groupId) => {
    try {
      await localApi.deleteGroup(groupId);
      set((state) => ({
        groups: state.groups.filter((group) => group.id !== groupId),
        currentGroup: state.currentGroup?.id === groupId ? null : state.currentGroup,
      }));
      return true;
    } catch { return false; }
  },

  fetchGroupMedia: async (groupId) => {
    try { set({ groupMedia: await localApi.media(groupId) }); } catch { set({ groupMedia: [] }); }
  },

  updateGroupSettings: async (groupId, settings) => {
    try {
      const updated = await localApi.updateGroup(groupId, settings);
      set((state) => ({
        groups: state.groups.map((group) => group.id === groupId ? updated : group),
        currentGroup: state.currentGroup?.id === groupId ? updated : state.currentGroup,
      }));
      return true;
    } catch { return false; }
  },

  setMediaFilter: (filter) => set({ mediaFilter: filter }),

  rateMedia: async (messageId, rating) => {
    await localApi.rate(messageId, rating);
    await get().fetchMediaRatings([messageId]);
  },

  fetchMediaRatings: async (messageIds) => {
    if (!messageIds.length) return;
    try {
      const rows = await localApi.ratings(messageIds);
      const ratings = { ...get().mediaRatings };
      for (const id of messageIds) ratings[id] = { avg: 0, count: 0 };
      for (const row of rows) ratings[row.message_id] = {
        avg: Math.round(Number(row.avg) * 10) / 10,
        count: Number(row.count),
        userRating: row.user_rating,
      };
      set({ mediaRatings: ratings });
    } catch { /* ratings are non-critical */ }
  },

  incrementViewCount: async (messageId) => {
    try {
      await localApi.view(messageId);
      set((state) => ({ groupMedia: state.groupMedia.map((message) => message.id === messageId ? { ...message, view_count: (message.view_count || 0) + 1 } : message) }));
    } catch { /* views are non-critical */ }
  },
}));
