import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  public_key: string | null;
  status: string | null;
  can_create_groups: boolean;
  created_at: string;
};

export type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  is_public: boolean;
  created_at: string;
  member_count?: number;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  profile?: Profile;
};

export type JoinRequest = {
  id: string;
  group_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profile?: Profile;
};

export type Topic = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  created_by: string;
  position: number;
  created_at: string;
};

export type Message = {
  id: string;
  topic_id: string;
  user_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  replied_to: string | null;
  media_group_id: string | null;
  is_edited?: boolean;
  created_at: string;
  profile?: Profile;
};
