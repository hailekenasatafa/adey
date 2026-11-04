import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { estimatePrice, formatMoney, friendlyError, type ScreenCard, type SubmitResult } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useLocation } from '@/lib/location';
import { useCampaignCart } from '@/lib/campaignCart';
import { Button, Card, Header, Loading, Screen, Text } from '@/components/ui';
import { ScreenCardItem } from '@/components/cards';

/** Add or replace screens on an existing campaign (same dates); submits one request per new screen. */
export default function AddScreens() {
  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();
  const { location } = useLocation();
  const cart = useCampaignCart();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const c = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.campaigns.get(campaignId!) });
  const existing = new Set((c.data?.requests ?? []).filter((r) => !['declined', 'expired', 'cancelled', 'withdrawn'].includes(r.status)).map((r) => r.screen_id));
  const days = c.data?.duration_days ?? 30;
  const inventory = useQuery({
    queryKey: ['search-screens', 'add', campaignId, location.lat.toFixed(1)],
    enabled: !!c.data,
    queryFn: () => api.adconnect.searchScreens({ p_start: c.data!.start_date!, p_end: c.data!.end_date!, p_lat: location.lat, p_lng: location.lng, p_sort: 'relevance', p_limit: 50, p_price_max_cents: c.data!.max_price_per_location_cents ?? undefined }),
  });
  const candidates = useMemo(() => (inventory.data ?? []).filter((s) => !existing.has(s.id!) && s.business_id !== c.data?.advertiser_business_id), [inventory.data, c.data]);
  const total = cart.items.reduce((a, i) => a + estimatePrice(i.base_price_cents ?? 0, i.base_duration_days ?? 30, days), 0);

  const submit = useMutation({
    mutationFn: () => api.campaigns.submitRequests(campaignId!, cart.items.map((i) => ({ screen_id: i.id!, proposed_price_cents: estimatePrice(i.base_price_cents ?? 0, i.base_duration_days ?? 30, days) }))),
    onSuccess: (r) => { setResult(r); cart.clear(); qc.invalidateQueries({ queryKey: ['campaign', campaignId] }); qc.invalidateQueries({ queryKey: ['campaign-summary', campaignId] }); },
    onError: (e) => setError(friendlyError(e)),
  });

  if (c.isLoading) return <Screen header={<Header title="Add screens" />}><Loading /></Screen>;
  if (result) {
    return (
      <Screen header={<Header title="Requests sent" back={false} />}>
        <Card><Text variant="heading">{result.submitted} sent{result.failed ? `, ${result.failed} failed` : ''}</Text>{result.results.filter((r) => !r.ok).map((r) => <Text key={r.screen_id} variant="caption" color="danger">• {r.error}</Text>)}</Card>
        <Button title="Back to campaign" fullWidth style={{ marginTop: 16 }} onPress={() => router.replace(`/adconnect/campaigns/${campaignId}`)} />
      </Screen>
    );
  }
  return (
    <Screen header={<Header title="Add screens" subtitle={c.data?.name} />}>
      <Card style={{ marginBottom: 12 }}>
        <Text color="muted">Same dates as the campaign ({c.data?.start_date} → {c.data?.end_date}). Only screens available for those dates are shown.</Text>
        {cart.items.length > 0 && <Text variant="bodyStrong" color="primary" style={{ marginTop: 6 }}>{cart.items.length} selected · {formatMoney(total)}</Text>}
      </Card>
      {inventory.isLoading ? <Loading /> : candidates.length === 0 ? <Text color="muted">No additional screens available for these dates.</Text> : (
        <View style={{ gap: 10 }}>{candidates.map((s: ScreenCard) => <ScreenCardItem key={s.id} s={s} selected={cart.has(s.id!)} onToggle={() => cart.toggle({ id: s.id, business_id: s.business_id, business_name: s.business_name, city: s.city, state: s.state, title: s.title, image: s.image, base_price_cents: s.base_price_cents, base_duration_days: s.base_duration_days, currency: s.currency, badges: s.badges, rating_avg: s.rating_avg })} />)}</View>
      )}
      {error && <Text color="danger" variant="caption" style={{ marginTop: 12 }}>{error}</Text>}
      <Button title={`Send ${cart.items.length} request${cart.items.length === 1 ? '' : 's'}`} size="lg" fullWidth style={{ marginTop: 20 }} disabled={cart.items.length === 0} loading={submit.isPending} onPress={() => submit.mutate()} />
    </Screen>
  );
}
