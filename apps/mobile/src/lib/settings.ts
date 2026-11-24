import { useQuery } from '@tanstack/react-query';
import { api } from './supabase';

/**
 * AdConnect switch set by Adey admins. While `campaigns_enabled` is off (the launch setting),
 * advertisers contact screen owners directly; campaign, request and booking tools stay hidden.
 */
export function useAdconnect() {
  const q = useQuery({ queryKey: ['settings', 'adconnect'], queryFn: () => api.settings.get<{ campaigns_enabled?: boolean }>('adconnect'), staleTime: 5 * 60_000 });
  return { campaignsEnabled: !!q.data?.campaigns_enabled, loading: q.isLoading };
}

/** New / Trending / saves / highlighted review / active deal for a set of business cards. */
export function useSignals(businessIds: (string | null | undefined)[]) {
  const ids = [...new Set(businessIds.filter(Boolean) as string[])].sort();
  return useQuery({ queryKey: ['signals', ids], queryFn: () => api.market.signals(ids), enabled: ids.length > 0, staleTime: 60_000 });
}
