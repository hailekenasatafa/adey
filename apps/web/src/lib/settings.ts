'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';

export type AdconnectSettings = { campaigns_enabled?: boolean };
export type AppSettings = { support_email?: string | null; tagline_en?: string };

/**
 * AdConnect switch set by Adey admins. While `campaigns_enabled` is off (the launch setting),
 * advertisers contact screen owners directly; campaign, request and booking tools stay hidden.
 */
export function useAdconnect() {
  const q = useQuery({ queryKey: ['settings', 'adconnect'], queryFn: () => api.settings.get<AdconnectSettings>('adconnect'), staleTime: 5 * 60_000 });
  return { campaignsEnabled: !!q.data?.campaigns_enabled, loading: q.isLoading };
}

/** General app settings (support address shown in the footer and on legal pages). */
export function useAppSettings() {
  const q = useQuery({ queryKey: ['settings', 'app'], queryFn: () => api.settings.get<AppSettings>('app'), staleTime: 30 * 60_000 });
  return q.data ?? null;
}
