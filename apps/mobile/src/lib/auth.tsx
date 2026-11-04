import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, supabase } from './supabase';
import type { Profile } from '@adey/shared';

type MyBusiness = Awaited<ReturnType<typeof api.owner.myBusinesses>>[number];

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  businesses: MyBusiness[];
  /** Derived roles — never stored separately. */
  roles: { customer: boolean; businessOwner: boolean; advertiser: boolean; screenOwner: boolean; staff: boolean; admin: boolean };
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const userId = session?.user.id;
  const profileQ = useQuery({ queryKey: ['profile', userId], queryFn: () => api.profile.me(), enabled: !!userId, staleTime: 60_000 });
  const bizQ = useQuery({ queryKey: ['my-businesses', userId], queryFn: () => api.owner.myBusinesses(), enabled: !!userId, staleTime: 60_000 });

  const refresh = useCallback(async () => {
    await Promise.all([profileQ.refetch(), bizQ.refetch()]);
  }, [profileQ, bizQ]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    qc.clear();
  }, [qc]);

  const value = useMemo<AuthContextValue>(() => {
    const businesses = bizQ.data ?? [];
    const profile = profileQ.data ?? null;
    return {
      session,
      user: session?.user ?? null,
      profile,
      businesses,
      roles: {
        customer: !!session,
        businessOwner: businesses.length > 0,
        advertiser: businesses.some((b) => b.advertises),
        screenOwner: businesses.some((b) => b.offers_ad_screens || (b.screen_count ?? 0) > 0),
        staff: profile?.platform_role === 'admin' || profile?.platform_role === 'moderator',
        admin: profile?.platform_role === 'admin',
      },
      loading: loading || (!!userId && profileQ.isLoading),
      refresh,
      signOut,
    };
  }, [session, profileQ.data, profileQ.isLoading, bizQ.data, loading, userId, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
