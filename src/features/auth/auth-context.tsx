import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { queryClient } from '@/lib/query/client';
import { router } from '@/app/router';
import { supabase } from '@/lib/supabase/client';
import { AuthContext, type AuthContextValue } from '@/features/auth/context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      // Authorize Realtime so RLS-filtered postgres_changes reach this client.
      supabase.realtime.setAuth(data.session?.access_token ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      supabase.realtime.setAuth(nextSession?.access_token ?? null);
      setLoading(false);
      // Re-run route guards and drop cached household data on identity change.
      void queryClient.invalidateQueries();
      void router.invalidate();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signUp: async ({ email, password }) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      signIn: async ({ email, password }) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
