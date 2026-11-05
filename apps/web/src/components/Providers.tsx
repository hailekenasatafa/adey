'use client';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { api, supabase } from '@/lib/supabase/client';
import type { Profile } from '@adey/shared';

type MyBusiness = Awaited<ReturnType<typeof api.owner.myBusinesses>>[number];
type AuthCtx = { session: Session | null; profile: Profile | null; businesses: MyBusiness[]; loading: boolean; isStaff: boolean; isAdmin: boolean; refresh: () => void };
const Ctx = createContext<AuthCtx>({ session: null, profile: null, businesses: [], loading: true, isStaff: false, isAdmin: false, refresh: () => {} });

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={qc}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const uid = session?.user.id;
  const profile = useQuery({ queryKey: ['profile', uid], queryFn: () => api.profile.me(), enabled: !!uid });
  const biz = useQuery({ queryKey: ['my-businesses', uid], queryFn: () => api.owner.myBusinesses(), enabled: !!uid });
  const value = useMemo<AuthCtx>(() => ({
    session, profile: profile.data ?? null, businesses: biz.data ?? [], loading: loading || (!!uid && profile.isLoading),
    isStaff: profile.data?.platform_role === 'admin' || profile.data?.platform_role === 'moderator', isAdmin: profile.data?.platform_role === 'admin',
    refresh: () => { profile.refetch(); biz.refetch(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query objects are stable handles; data/loading are listed
  }), [session, profile.data, profile.isLoading, biz.data, loading, uid]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
