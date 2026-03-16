import { create } from 'zustand';
import { supabase, type Group, type GroupMember, type JoinRequest, type Topic } from '../lib/supabase';

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  members: GroupMember[];
  topics: Topic[];
  joinRequests: JoinRequest[];
  searchResults: Group[];
  groupMedia: any[];
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
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  currentGroup: null,
  members: [],
  topics: [],
  joinRequests: [],
  searchResults: [],
  groupMedia: [],
  loading: false,
  error: null,

  fetchMyGroups: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        const { data: groups } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false });
        set({ groups: groups || [], loading: false });
      } else {
        set({ groups: [], loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchGroup: async (groupId: string) => {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();
    if (data) set({ currentGroup: data });
  },

  fetchMembers: async (groupId: string) => {
    const { data } = await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .eq('group_id', groupId);
    set({ members: data || [] });
  },

  fetchTopics: async (groupId: string) => {
    const { data } = await supabase
      .from('topics')
      .select('*')
      .eq('group_id', groupId)
      .order('position', { ascending: true });
    set({ topics: data || [] });
  },

  fetchJoinRequests: async (groupId: string) => {
    const { data } = await supabase
      .from('join_requests')
      .select('*, profile:profiles(*)')
      .eq('group_id', groupId)
      .eq('status', 'pending');
    set({ joinRequests: data || [] });
  },

  createGroup: async (name: string, description: string, isPublic: boolean) => {
    set({ error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: group, error } = await supabase
        .from('groups')
        .insert({ name, description, is_public: isPublic, created_by: user.id })
        .select()
        .single();

      if (error) {
        set({ error: error.message });
        return null;
      }

      // Add creator as admin
      await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'admin' });

      // Create default "General" topic
      await supabase
        .from('topics')
        .insert({ group_id: group.id, name: 'General', description: 'Tema general', created_by: user.id, position: 0 });

      const { groups } = get();
      set({ groups: [group, ...groups] });
      return group;
    } catch {
      set({ error: 'Error al crear grupo' });
      return null;
    }
  },

  searchGroups: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('is_public', true)
      .ilike('name', `%${query}%`)
      .limit(20);
    set({ searchResults: data || [] });
  },

  deleteGroup: async (groupId: string) => {
    try {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) throw error;
      
      const { groups, currentGroup } = get();
      set({ 
        groups: groups.filter(g => g.id !== groupId),
        currentGroup: currentGroup?.id === groupId ? null : currentGroup 
      });
      return true;
    } catch (e) {
      console.error('Error deleting group:', e);
      return false;
    }
  },

  fetchGroupMedia: async (groupId: string) => {
    try {
      // First get all topics for the group
      const { data: topics } = await supabase
        .from('topics')
        .select('id')
        .eq('group_id', groupId);

      if (!topics || topics.length === 0) return set({ groupMedia: [] });

      const topicIds = topics.map(t => t.id);

      // Fetch messages that are not plain text or text that contains http
      const { data: mediaMessages } = await supabase
        .from('messages')
        .select('*, profile:profiles(*)')
        .in('topic_id', topicIds)
        .neq('type', 'text')
        .order('created_at', { ascending: false });

      // We also fetch text messages that might contain links
      const { data: linkMessages } = await supabase
        .from('messages')
        .select('*, profile:profiles(*)')
        .in('topic_id', topicIds)
        .eq('type', 'text')
        .ilike('content', '%http%')
        .order('created_at', { ascending: false });

      const allMedia = [...(mediaMessages || []), ...(linkMessages || [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      set({ groupMedia: allMedia });
    } catch (e) {
      console.error('Error fetching group media:', e);
      set({ groupMedia: [] });
    }
  },

  requestJoin: async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('join_requests')
        .insert({ group_id: groupId, user_id: user.id, status: 'pending' });
      return !error;
    } catch {
      return false;
    }
  },

  joinGroup: async (groupId: string) => {
    const { groups } = get();
    if (groups.some(g => g.id === groupId)) return 'joined';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'error';

      // Get group details
      const { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (!group) return 'error';

      if (group.is_public) {
        // Direct join for public groups
        const { error } = await supabase
          .from('group_members')
          .insert({ group_id: groupId, user_id: user.id, role: 'member' });
        
        if (!error) {
          await get().fetchMyGroups();
          return 'joined';
        }
      } else {
        // Request join for private groups
        const { error } = await supabase
          .from('join_requests')
          .insert({ group_id: groupId, user_id: user.id, status: 'pending' });
        
        if (!error) return 'requested';
      }
      return 'error';
    } catch {
      return 'error';
    }
  },

  handleJoinRequest: async (requestId: string, approve: boolean) => {
    try {
      const { data: request } = await supabase
        .from('join_requests')
        .update({ status: approve ? 'approved' : 'rejected' })
        .eq('id', requestId)
        .select()
        .single();

      if (request && approve) {
        await supabase
          .from('group_members')
          .insert({ group_id: request.group_id, user_id: request.user_id, role: 'member' });
      }

      // Refresh requests
      if (request) {
        get().fetchJoinRequests(request.group_id);
      }
      return true;
    } catch {
      return false;
    }
  },

  createTopic: async (groupId: string, name: string, description: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { topics } = get();
      const position = topics.length;

      const { data, error } = await supabase
        .from('topics')
        .insert({ group_id: groupId, name, description, created_by: user.id, position })
        .select()
        .single();

      if (error) return null;
      set({ topics: [...topics, data] });
      return data;
    } catch {
      return null;
    }
  },

  setCurrentGroup: (group) => set({ currentGroup: group }),
  clearError: () => set({ error: null }),
}));
