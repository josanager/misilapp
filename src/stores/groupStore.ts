import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, type Group, type GroupMember, type JoinRequest, type Topic } from '../lib/supabase';

export type MediaFilter = 'recent' | 'top_rated' | 'most_viewed';

export type MediaRatingInfo = {
  avg: number;
  count: number;
  userRating?: number;
};

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  members: GroupMember[];
  topics: Topic[];
  joinRequests: JoinRequest[];
  searchResults: Group[];
  groupMedia: any[];
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

export const useGroupStore = create<GroupState>()(
  persist(
    (set, get) => ({
  groups: [],
  currentGroup: null,
  members: [],
  topics: [],
  joinRequests: [],
  searchResults: [],
  groupMedia: [],
  mediaRatings: {},
  mediaFilter: 'recent' as MediaFilter,
  loading: false,
  error: null,

  fetchMyGroups: async () => {
    // We do NOT set loading to true here if we already have cached groups,
    // to prevent the UI from flickering or showing spinners unnecessarily.
    if (get().groups.length === 0) set({ loading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use a single query with inner join to fetch the groups directly
      const { data, error } = await supabase
        .from('group_members')
        .select('groups!inner(*)')
        .eq('user_id', user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        // Extract the groups array from the join result
        const groups = data.map((item: any) => item.groups).sort((a: Group, b: Group) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        set({ groups, loading: false });
      } else {
        set({ groups: [], loading: false });
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
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
    let { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('group_id', groupId)
      .order('position', { ascending: true });

    if ((!data || data.length === 0) && !error) {
      // If no topics exist, try to create a default "General" one
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if user is member/admin to have permission
        const { data: member } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .single();
        
        if (member) {
          const { data: newTopic } = await supabase
            .from('topics')
            .insert({ group_id: groupId, name: 'General', description: 'Tema general', created_by: user.id, position: 0 })
            .select()
            .single();
          if (newTopic) data = [newTopic];
        }
      }
    }
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
    if (!query.trim() || query.length < 2) {
      set({ searchResults: [] });
      return;
    }
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('is_public', true)
      .ilike('name', `%${query}%`)
      .limit(10);
    
    // Filter out groups the user is already in
    const { groups } = get();
    const joinedIds = new Set(groups.map(g => g.id));
    const filtered = (data || []).filter(g => !joinedIds.has(g.id));
    
    set({ searchResults: filtered });
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

  updateGroupSettings: async (groupId: string, settings: Partial<Group>) => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .update(settings)
        .eq('id', groupId)
        .select()
        .single();

      if (error) {
        console.error('Error updating group settings:', error);
        return false;
      }

      if (data) {
        const { groups, currentGroup } = get();
        set({
          groups: groups.map(g => g.id === groupId ? data : g),
          currentGroup: currentGroup?.id === groupId ? data : currentGroup
        });
      }
      return true;
    } catch (e) {
      console.error('Exception updating group settings:', e);
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

      if (!topics || topics.length === 0) {
        set({ groupMedia: [] });
        return;
      }

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
    try {
      const { groups } = get();
      if (groups.some(g => g.id === groupId)) return 'joined';

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
        const { error } = await supabase
          .from('group_members')
          .insert({ group_id: groupId, user_id: user.id, role: 'member' });
        
        if (!error || error.code === '23505') { // 23505 is unique violation (already a member)
          await get().fetchMyGroups();
          return 'joined';
        }
      } else {
        const { error } = await supabase
          .from('join_requests')
          .insert({ group_id: groupId, user_id: user.id, status: 'pending' });
        
        if (!error) return 'requested';
        if (error.code === '23505') return 'requested'; // Already requested
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

  setMediaFilter: (filter) => set({ mediaFilter: filter }),

  rateMedia: async (messageId: string, rating: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert: insert or update rating
      const { error } = await supabase
        .from('media_ratings')
        .upsert(
          { message_id: messageId, user_id: user.id, rating },
          { onConflict: 'message_id,user_id' }
        );

      if (error) {
        console.error('Error rating media:', error);
        return;
      }

      // Refresh ratings for this message
      await get().fetchMediaRatings([messageId]);
    } catch (e) {
      console.error('Exception rating media:', e);
    }
  },

  fetchMediaRatings: async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data } = await supabase
        .from('media_ratings')
        .select('*')
        .in('message_id', messageIds);

      if (data) {
        const grouped: Record<string, MediaRatingInfo> = { ...get().mediaRatings };

        // Initialize all requested IDs
        messageIds.forEach(id => {
          grouped[id] = { avg: 0, count: 0, userRating: undefined };
        });

        // Group ratings by message_id
        const byMessage: Record<string, number[]> = {};
        data.forEach(r => {
          if (!byMessage[r.message_id]) byMessage[r.message_id] = [];
          byMessage[r.message_id].push(r.rating);
          // Track user's own rating
          if (user && r.user_id === user.id) {
            grouped[r.message_id] = { ...grouped[r.message_id], userRating: r.rating };
          }
        });

        // Calculate averages
        Object.entries(byMessage).forEach(([msgId, ratings]) => {
          const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
          grouped[msgId] = { ...grouped[msgId], avg: Math.round(avg * 10) / 10, count: ratings.length };
        });

        set({ mediaRatings: grouped });
      }
    } catch (e) {
      console.error('Error fetching media ratings:', e);
    }
  },

  incrementViewCount: async (messageId: string) => {
    try {
      // Use RPC or raw update to increment. Since Supabase doesn't support
      // atomic increment easily, we'll fetch + update.
      const { data: msg } = await supabase
        .from('messages')
        .select('view_count')
        .eq('id', messageId)
        .single();

      if (msg) {
        await supabase
          .from('messages')
          .update({ view_count: (msg.view_count || 0) + 1 })
          .eq('id', messageId);

        // Update local groupMedia
        set(state => ({
          groupMedia: state.groupMedia.map(m =>
            m.id === messageId ? { ...m, view_count: (m.view_count || 0) + 1 } : m
          )
        }));
      }
    } catch (e) {
      console.error('Error incrementing view count:', e);
    }
  },
    }),
    {
      name: 'misil-groups-storage',
      // Only persist the `groups` list to cache it for instant loading.
      // Other states like currentGroup or topics are transient.
      partialize: (state) => ({ groups: state.groups }),
    }
  )
);
