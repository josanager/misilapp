import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, type Profile } from '../lib/supabase';

interface AuthState {
  user: Profile | null;
  session: any;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  initialize: async () => {
    // Si ya tenemos un usuario en cache, quitamos el loading de inmediato
    if (get().user) {
      set({ loading: false });
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({ user: profile, session, loading: false });
      } else {
        set({ loading: false });
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          set({ user: profile, session });
        } else {
          set({ user: null, session: null });
        }
      });
    } catch {
      set({ loading: false });
    }
  },

  login: async (username: string, password: string) => {
    set({ error: null, loading: true });
    try {
      const email = `${username.toLowerCase()}@chatlatino.app`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        set({ error: 'Usuario o contraseña incorrectos', loading: false });
        return false;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // Update presence
      await supabase
        .from('user_presence')
        .upsert({ user_id: data.user.id, status: 'online', last_seen: new Date().toISOString() });

      set({ user: profile, session: data.session, loading: false });
      return true;
    } catch {
      set({ error: 'Error al iniciar sesión', loading: false });
      return false;
    }
  },

  register: async (username: string, password: string, displayName: string) => {
    set({ error: null, loading: true });
    try {
      // Check if username exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (existing) {
        set({ error: 'Este nombre de usuario ya existe', loading: false });
        return false;
      }

      const email = `${username.toLowerCase()}@chatlatino.app`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            display_name: displayName,
          }
        }
      });

      if (error) {
        set({ error: error.message, loading: false });
        return false;
      }

      if (data.user) {
        // Wait a moment for trigger to create profile
        await new Promise(r => setTimeout(r, 500));
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // Update presence
        await supabase
          .from('user_presence')
          .upsert({ user_id: data.user.id, status: 'online', last_seen: new Date().toISOString() });

        set({ user: profile, session: data.session, loading: false });
      }
      return true;
    } catch {
      set({ error: 'Error al registrarse', loading: false });
      return false;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { user } = get();
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) return false;
      set({ user: { ...user, ...updates } });
      return true;
    } catch {
      return false;
    }
  },

  changePassword: async (_currentPassword: string, newPassword: string) => {
    set({ error: null });
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        set({ error: 'Error al cambiar contraseña' });
        return false;
      }
      return true;
    } catch {
      set({ error: 'Error al cambiar contraseña' });
      return false;
    }
  },

  clearError: () => set({ error: null }),
    }),
    {
      name: 'misil-auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
