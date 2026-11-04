import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import { campaignBudgetSchema, campaignInfoSchema, daysBetweenInclusive, estimatePrice, formatMoney, friendlyError, type ScreenCard, type SubmitResult, validateUpload } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location';
import { useCampaignCart, type CartItem } from '@/lib/campaignCart';
import { pickImages, pickVideo, uploadFile, type PickedFile } from '@/lib/upload';
import { addDays, toISODate } from '@/lib/format';
import { track } from '@/lib/analytics';
import { Badge, Button, Card, Chip, EmptyState, Header, Input, Screen, Text, VerificationBadges } from '@/components/ui';
import { BusinessPicker, useSelectedBusiness } from '@/components/BusinessPicker';
import { ScreenCardItem, cover } from '@/components/cards';

const STEPS = ['Campaign', 'Targeting', 'Budget', 'Advertisement', 'Screens', 'Submit'];
const US_STATES = ['MD', 'VA', 'DC', 'GA', 'TX', 'MN', 'WA', 'CA', 'CO', 'NY', 'NJ', 'PA', 'MA', 'IL', 'NC', 'FL'];

type Draft = {
  name: string; objective: string; start_date: string; end_date: string;
  states: string[]; cities: string; category_ids: string[]; preferred_locations: string; desired_screen_count: number;
  budget: string; price_min: string; price_max: string; max_per_location: string;
  video_path: string | null; image_path: string | null; instructions: string;
  video_name: string | null; image_name: string | null;
  prices: Record<string, string>; // per-screen proposed price overrides (dollars)
};

export default function CampaignWizard() {
  const { colors, radius } = useTheme();
  const { user, businesses } = useAuth();
  const { location } = useLocation();
  const cart = useCampaignCart();
  const [bizId, setBizId] = useSelectedBusiness(undefined);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'video' | 'image' | null>(null);
  const [result, setResult] = useState<(SubmitResult & { campaignId: string }) | null>(null);
  // Campaign id is minted up-front so creatives land in <advertiser>/<campaign>/ where screen owners' read policy expects them.
  const [campaignId] = useState(() => Crypto.randomUUID());
  const today = toISODate(new Date());
  const [d, setD] = useState<Draft>({ name: '', objective: '', start_date: addDays(today, 7), end_date: addDays(today, 36), states: ['MD', 'VA', 'DC'], cities: '', category_ids: [], preferred_locations: '', desired_screen_count: 10, budget: '', price_min: '', price_max: '', max_per_location: '', video_path: null, image_path: null, instructions: '', video_name: null, image_name: null, prices: {} });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const days = daysBetweenInclusive(d.start_date, d.end_date);
  const categories = useQuery({ queryKey: ['categories', 'us'], queryFn: () => api.market.categories('us'), staleTime: 10 * 60_000 });
  const limits = useQuery({ queryKey: ['settings', 'campaigns'], queryFn: () => api.settings.get<{ max_screens_per_campaign: number; request_expiry_hours: number }>('campaigns'), staleTime: 10 * 60_000 });
  const maxScreens = limits.data?.max_screens_per_campaign ?? 50;

  // Inventory for step 5, filtered by targeting; availability for the chosen dates.
  const inventory = useQuery({
    queryKey: ['search-screens', 'wizard', d.states, d.cities, d.category_ids, d.start_date, d.end_date, d.max_per_location],
    enabled: step === 4,
    queryFn: async () => {
      const cities = d.cities.split(',').map((c) => c.trim()).filter(Boolean);
      const states = d.states.length ? d.states : [undefined];
      const results = await Promise.all(states.map((st) => api.adconnect.searchScreens({ p_state: st, p_city: cities[0], p_category_id: d.category_ids[0], p_start: d.start_date, p_end: d.end_date, p_price_max_cents: d.max_per_location ? Math.round(Number(d.max_per_location) * 100) : undefined, p_lat: location.lat, p_lng: location.lng, p_sort: 'relevance', p_limit: 50 })));
      const seen = new Set<string>();
      return results.flat().filter((s) => (s.business_id !== bizId) && !seen.has(s.id!) && seen.add(s.id!));
    },
  });
  const suggest = useMutation({
    mutationFn: () => api.adconnect.suggest({ p_budget_cents: Math.round(Number(d.budget) * 100), p_duration_days: days, p_desired_count: d.desired_screen_count, p_state: d.states[0], p_cities: d.cities ? d.cities.split(',').map((c) => c.trim()).filter(Boolean) : undefined, p_category_ids: d.category_ids.length ? d.category_ids : undefined, p_start: d.start_date, p_end: d.end_date, p_exclude_business_id: bizId ?? undefined }),
    onSuccess: (r) => {
      const sel = (r as { selected: { screen_id: string; business_id: string; business_name: string; city: string; state: string; title: string; image: string | null; price_cents: number; rating_avg: number | null }[] }).selected;
      cart.setMany(sel.map((x) => ({ id: x.screen_id, business_id: x.business_id, business_name: x.business_name, city: x.city, state: x.state, title: x.title, image: x.image, base_price_cents: x.price_cents, base_duration_days: days, currency: 'USD', badges: [], rating_avg: x.rating_avg })));
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const estimate = (item: CartItem) => (d.prices[item.id!] ? Math.round(Number(d.prices[item.id!]) * 100) : estimatePrice(item.base_price_cents ?? 0, item.base_duration_days ?? 30, days));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- estimate depends only on d.prices and days
  const total = useMemo(() => cart.items.reduce((a, i) => a + estimate(i), 0), [cart.items, d.prices, days]);
  const budgetCents = Math.round(Number(d.budget || 0) * 100);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !bizId) throw new Error('Choose the advertising business first');
      const info = campaignInfoSchema.parse({ name: d.name, advertiser_business_id: bizId, objective: d.objective, start_date: d.start_date, end_date: d.end_date });
      const budget = campaignBudgetSchema.parse({ budget_total_cents: budgetCents, price_min_cents: d.price_min ? Math.round(Number(d.price_min) * 100) : null, price_max_cents: d.price_max ? Math.round(Number(d.price_max) * 100) : null, max_price_per_location_cents: d.max_per_location ? Math.round(Number(d.max_per_location) * 100) : null });
      const c = await api.campaigns.create({
        id: campaignId, advertiser_business_id: bizId, created_by: user.id, name: info.name, objective: info.objective || null, start_date: info.start_date, end_date: info.end_date,
        targeting: { states: d.states, cities: d.cities.split(',').map((x) => x.trim()).filter(Boolean), category_ids: d.category_ids, preferred_locations: d.preferred_locations, desired_screen_count: d.desired_screen_count },
        budget_total_cents: budget.budget_total_cents, price_min_cents: budget.price_min_cents ?? null, price_max_cents: budget.price_max_cents ?? null, max_price_per_location_cents: budget.max_price_per_location_cents ?? null,
        creative_video_path: d.video_path, creative_image_path: d.image_path, creative_instructions: d.instructions || null, status: 'draft',
      });
      const r = await api.campaigns.submitRequests(c.id, cart.items.map((i) => ({ screen_id: i.id!, package_id: i.package_id ?? null, proposed_price_cents: estimate(i), message: d.instructions ? d.instructions.slice(0, 500) : undefined })));
      return { ...r, campaignId: c.id };
    },
    onSuccess: (r) => {
      setResult(r);
      track('campaign_request_sent', { businessId: bizId, meta: { submitted: r.submitted, failed: r.failed } });
      cart.setMany(cart.items.filter((i) => r.results.some((x) => x.screen_id === i.id && !x.ok)));
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const pick = async (kind: 'video' | 'image') => {
    try {
      setError(null);
      const file: PickedFile | null = kind === 'video' ? await pickVideo() : (await pickImages())[0] ?? null;
      if (!file) return;
      const problem = validateUpload(kind, { size: file.size, mimeType: file.mimeType });
      if (problem) return setError(problem);
      if (kind === 'video' && file.duration && file.duration > 60_000) return setError('Videos must be 60 seconds or shorter.');
      setUploading(kind);
      const path = await uploadFile('campaign-creatives', `${bizId}/${campaignId}`, file, kind);
      if (kind === 'video') { set('video_path', path); set('video_name', file.name); } else { set('image_path', path); set('image_name', file.name); }
    } catch (e) { setError(friendlyError(e)); } finally { setUploading(null); }
  };

  const canNext = [
    () => d.name.trim().length >= 2 && !!bizId && d.end_date >= d.start_date && days >= 1,
    () => true,
    () => budgetCents >= 100,
    () => !!d.video_path || !!d.image_path || d.instructions.trim().length > 0,
    () => cart.items.length > 0 && cart.items.length <= maxScreens,
    () => true,
  ][step]();

  if (!user) { router.replace('/(auth)/sign-in'); return null; }
  if (businesses.filter((b) => b.role !== 'staff').length === 0) return <Screen header={<Header title="Create campaign" />}><EmptyState icon="megaphone-outline" title="Create your advertiser profile first" body="Campaigns are sent on behalf of a business." action="Set up" onAction={() => router.replace('/adconnect/get-started')} /></Screen>;

  if (result) {
    return (
      <Screen header={<Header title="Requests sent" back={false} />}>
        <Card>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Ionicons name={result.failed === 0 ? 'checkmark-circle' : 'alert-circle'} size={48} color={result.failed === 0 ? colors.success : colors.warning} />
            <Text variant="heading" center>{result.submitted} request{result.submitted === 1 ? '' : 's'} sent</Text>
            {result.failed > 0 && <Text color="warning" center>{result.failed} could not be sent — details below.</Text>}
            <Text color="muted" center>Each screen owner was notified and has {limits.data?.request_expiry_hours ?? 72} hours to accept, counter, or decline. Nothing is booked or paid until an owner accepts.</Text>
          </View>
        </Card>
        <View style={{ gap: 8, marginTop: 12 }}>
          {result.results.map((r) => {
            const item = cart.items.find((i) => i.id === r.screen_id);
            return (
              <Card key={r.screen_id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={r.ok ? 'checkmark-circle' : 'close-circle'} size={22} color={r.ok ? colors.success : colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{item?.business_name ?? r.screen_id.slice(0, 8)}</Text>
                    <Text variant="caption" color={r.ok ? 'muted' : 'danger'}>{r.ok ? `Proposed ${formatMoney(r.price_cents)}` : r.error}</Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
        <Button title="Open campaign" size="lg" fullWidth style={{ marginTop: 20 }} onPress={() => router.replace(`/adconnect/campaigns/${result.campaignId}`)} />
        {result.failed > 0 && <Button title="Retry failed with other screens" variant="ghost" style={{ marginTop: 8 }} onPress={() => { setResult(null); setStep(4); }} />}
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="Create campaign" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} />} keyboard>
      <View style={styles.progress}>{STEPS.map((s, i) => <View key={s} style={[styles.seg, { backgroundColor: i <= step ? colors.primary : colors.border }]} />)}</View>

      {step === 0 && (
        <View>
          <Text variant="label" style={{ marginBottom: 8 }}>Advertiser business</Text>
          <BusinessPicker value={bizId} onChange={setBizId} />
          {businesses.filter((b) => b.role !== 'staff').length === 1 && <Badge label={businesses[0].name} tone="primary" />}
          <Input label="Campaign name" value={d.name} onChangeText={(t) => set('name', t)} placeholder="e.g. Spring open-house push" containerStyle={{ marginTop: 14 }} />
          <Input label="Objective (optional)" value={d.objective} onChangeText={(t) => set('objective', t)} placeholder="What should viewers do? Visit, call, remember your brand…" multiline />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Start date" value={d.start_date} onChangeText={(t) => set('start_date', t)} autoCapitalize="none" placeholder="YYYY-MM-DD" /></View>
            <View style={{ flex: 1 }}><Input label="End date" value={d.end_date} onChangeText={(t) => set('end_date', t)} autoCapitalize="none" placeholder="YYYY-MM-DD" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[7, 14, 30, 60, 90].map((n) => <Chip key={n} small label={`${n} days`} selected={days === n} onPress={() => set('end_date', addDays(d.start_date, n - 1))} />)}
          </View>
          <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Duration: {days} day{days === 1 ? '' : 's'}</Text>
        </View>
      )}

      {step === 1 && (
        <View>
          <Text variant="label" style={{ marginBottom: 8 }}>States</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{US_STATES.map((s) => <Chip key={s} small label={s} selected={d.states.includes(s)} onPress={() => set('states', d.states.includes(s) ? d.states.filter((x) => x !== s) : [...d.states, s])} />)}</View>
          <Input label="Cities (comma separated, optional)" value={d.cities} onChangeText={(t) => set('cities', t)} placeholder="Silver Spring, Alexandria" />
          <Text variant="label" style={{ marginBottom: 8 }}>Business categories</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{categories.data?.map((c) => <Chip key={c.id} small label={c.name_en} selected={d.category_ids.includes(c.id)} onPress={() => set('category_ids', d.category_ids.includes(c.id) ? d.category_ids.filter((x) => x !== c.id) : [...d.category_ids, c.id])} />)}</View>
          <Input label="Preferred locations (optional)" value={d.preferred_locations} onChangeText={(t) => set('preferred_locations', t)} placeholder="Near Metro stations, church neighbourhoods, …" multiline />
          <Text variant="label" style={{ marginBottom: 8 }}>Desired number of screens</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{[5, 10, 20, 30, 50].filter((n) => n <= maxScreens).map((n) => <Chip key={n} small label={String(n)} selected={d.desired_screen_count === n} onPress={() => set('desired_screen_count', n)} />)}</View>
          <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Platform limit: {maxScreens} screens per campaign.</Text>
        </View>
      )}

      {step === 2 && (
        <View>
          <Input label="Total budget (USD)" value={d.budget} onChangeText={(t) => set('budget', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="1500" icon="cash-outline" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Preferred min / location" value={d.price_min} onChangeText={(t) => set('price_min', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="50" /></View>
            <View style={{ flex: 1 }}><Input label="Preferred max / location" value={d.price_max} onChangeText={(t) => set('price_max', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="100" /></View>
          </View>
          <Input label="Hard maximum per location (optional)" value={d.max_per_location} onChangeText={(t) => set('max_per_location', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" hint="Requests above this amount are rejected by the platform before they're sent." />
          {budgetCents > 0 && <Card><Text variant="caption" color="muted">With {d.desired_screen_count} screens for {days} days, that's about</Text><Text variant="heading" color="primary">{formatMoney(Math.floor(budgetCents / d.desired_screen_count))} per location</Text></Card>}
        </View>
      )}

      {step === 3 && (
        <View style={{ gap: 12 }}>
          <Text color="muted">Upload what the screens should play. Owners download it from the request; delivery is manual in this launch version.</Text>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="videocam-outline" size={26} color={colors.primary} />
              <View style={{ flex: 1 }}><Text variant="bodyStrong">Video</Text><Text variant="caption" color="muted">{d.video_name ?? 'MP4 or MOV · up to 60s · 200 MB'}</Text></View>
              <Button title={d.video_path ? 'Replace' : 'Upload'} size="sm" variant="secondary" loading={uploading === 'video'} onPress={() => pick('video')} />
            </View>
          </Card>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {d.image_path ? <Image source={{ uri: cover('campaign-creatives', d.image_path) ?? undefined }} style={{ width: 44, height: 44, borderRadius: 8 }} /> : <Ionicons name="image-outline" size={26} color={colors.primary} />}
              <View style={{ flex: 1 }}><Text variant="bodyStrong">Image</Text><Text variant="caption" color="muted">{d.image_name ?? 'JPG, PNG or WebP · 10 MB'}</Text></View>
              <Button title={d.image_path ? 'Replace' : 'Upload'} size="sm" variant="secondary" loading={uploading === 'image'} onPress={() => pick('image')} />
            </View>
          </Card>
          <Input label="Advertising instructions" value={d.instructions} onChangeText={(t) => set('instructions', t)} multiline placeholder="Play during dinner hours; show the QR code at the end; Amharic version attached…" />
        </View>
      )}

      {step === 4 && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="subheading">Selected ({cart.items.length}/{maxScreens})</Text>
            {budgetCents > 0 && <Button title="Suggest within budget" size="sm" variant="accent" icon="sparkles-outline" loading={suggest.isPending} onPress={() => suggest.mutate()} />}
          </View>
          {cart.items.length > 0 && (
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text color="muted">Estimated total for {days} days</Text><Text variant="bodyStrong" color={budgetCents && total > budgetCents ? 'danger' : 'primary'}>{formatMoney(total)}</Text></View>
              {budgetCents > 0 && <Text variant="caption" color="muted">Budget {formatMoney(budgetCents)} · {total > budgetCents ? `over by ${formatMoney(total - budgetCents)}` : `${formatMoney(budgetCents - total)} remaining`}</Text>}
              <Text variant="caption" color="muted">Schedule: {d.start_date} → {d.end_date}. Prices are proposals; owners may counter.</Text>
            </Card>
          )}
          {cart.items.map((i) => (
            <Card key={i.id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.thumb, { backgroundColor: colors.accentSoft, borderRadius: radius.sm }]}>{i.image ? <Image source={{ uri: cover('screen-media', i.image)! }} style={[styles.thumb, { borderRadius: radius.sm }]} /> : <Ionicons name="tv-outline" size={20} color={colors.accent} />}</View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>{i.business_name}</Text>
                  <Text variant="caption" color="muted" numberOfLines={1}>{i.title} · {[i.city, i.state].filter(Boolean).join(', ')}</Text>
                  <VerificationBadges badges={i.badges} compact />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Input value={d.prices[i.id!] ?? (estimate(i) / 100).toFixed(0)} onChangeText={(t) => set('prices', { ...d.prices, [i.id!]: t.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" containerStyle={{ width: 92, marginBottom: 0 }} accessibilityLabel="Proposed price" />
                  <Pressable onPress={() => cart.remove(i.id!)} hitSlop={8}><Text variant="caption" color="danger">Remove</Text></Pressable>
                </View>
              </View>
            </Card>
          ))}
          <Text variant="subheading" style={{ marginTop: 16, marginBottom: 8 }}>Available inventory</Text>
          {inventory.isLoading ? <Text color="muted">Loading screens…</Text> : (inventory.data ?? []).filter((s) => !cart.has(s.id!)).length === 0 ? <Text color="muted">No more screens match your targeting and dates. Loosen targeting in step 2.</Text> : (
            <View style={{ gap: 10 }}>{(inventory.data ?? []).filter((s) => !cart.has(s.id!)).map((s: ScreenCard) => <ScreenCardItem key={s.id} s={s} selected={false} onToggle={() => cart.toggle({ id: s.id, business_id: s.business_id, business_name: s.business_name, city: s.city, state: s.state, title: s.title, image: s.image, base_price_cents: s.base_price_cents, base_duration_days: s.base_duration_days, currency: s.currency, badges: s.badges, rating_avg: s.rating_avg })} />)}</View>
          )}
        </View>
      )}

      {step === 5 && (
        <View style={{ gap: 10 }}>
          <Card>
            <Text variant="overline" color="muted">Summary</Text>
            <Text variant="heading" style={{ marginTop: 4 }}>{d.name}</Text>
            <Text color="muted">{businesses.find((b) => b.id === bizId)?.name} · {d.start_date} → {d.end_date} ({days} days)</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}><Text>Screens</Text><Text variant="bodyStrong">{cart.items.length}</Text></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>Proposed total</Text><Text variant="bodyStrong">{formatMoney(total)}</Text></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>Budget</Text><Text variant="bodyStrong">{formatMoney(budgetCents)}</Text></View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>Creative</Text><Text variant="bodyStrong">{[d.video_path && 'video', d.image_path && 'image'].filter(Boolean).join(' + ') || 'instructions only'}</Text></View>
          </Card>
          <Card>
            <Text variant="caption" color="muted">Sending creates one request per business. Each owner responds independently. Accepted requests become bookings; in Free Launch Mode, payment is arranged directly between you and the owner and Adey takes no commission.</Text>
          </Card>
          {error && <Text color="danger" variant="caption">{error}</Text>}
          <Button title="SEND CAMPAIGN REQUESTS" size="lg" fullWidth variant="accent" icon="paper-plane" loading={submit.isPending} onPress={() => submit.mutate()} />
        </View>
      )}

      {error && step !== 5 && <Text color="danger" variant="caption" style={{ marginTop: 10 }}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        {step > 0 && <Button title="Back" variant="outline" style={{ flex: 1 }} onPress={() => setStep((s) => s - 1)} />}
        {step < 5 && <Button title="Continue" style={{ flex: 2 }} disabled={!canNext} iconRight="arrow-forward" onPress={() => { setError(null); setStep((s) => s + 1); }} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 4, marginBottom: 16 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  thumb: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
