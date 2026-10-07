import { createSessionFromUrl, isAuthCallbackUrl } from '@/lib/auth';
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthStore {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => () => void;
  handleDeepLink: (url: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isInitialized: false,

  initialize: () => {
    if (get().isInitialized) {
      return () => {};
    }

    set({ isInitialized: true });

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
    });

    return () => subscription.unsubscribe();
  },

  handleDeepLink: async (url) => {
    if (!isAuthCallbackUrl(url)) return;
    await createSessionFromUrl(url);
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  deleteAccount: async () => {
    const user = get().user;
    if (!user) throw new Error('Sign in to delete your account.');
    const { openRepositories } = await import('@/db/sqlite/open');
    const repositories = await openRepositories(user.id);
    const { error } = await supabase.rpc('delete_account');
    if (error) throw error;
    // The server has committed deletion. Always leave the deleted account even
    // if local cleanup fails; never present it as a failed server deletion.
    try {
      await repositories.clearAccount();
    } finally {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } finally {
        set({ session: null, user: null, isLoading: false });
      }
    }
  },
}));
