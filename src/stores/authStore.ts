import { create } from 'zustand';
import { localApi } from '../services/localApi';
import type { Profile } from '../types';

interface AuthState {
  user: Profile | null;
  session: null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: () => Promise<boolean>;
  register: () => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
  changePassword: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  initialize: async () => {
    try {
      const user = await localApi.profile();
      set({ user, loading: false, error: null });
    } catch {
      set({ loading: false, error: 'MISIL Node no está disponible. Ejecuta npm run dev.' });
    }
  },

  login: async () => true,
  register: async () => true,
  logout: async () => undefined,

  updateProfile: async (updates) => {
    try {
      const user = await localApi.updateProfile(updates);
      set({ user, error: null });
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo guardar el perfil local.' });
      return false;
    }
  },

  changePassword: async () => false,
  clearError: () => set({ error: null }),
}));
