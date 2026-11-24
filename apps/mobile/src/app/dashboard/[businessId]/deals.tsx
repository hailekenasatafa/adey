import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealRedeemMessages, dealSchema, dealStatusLabels, friendlyError, type DealRedeemResult, type DealStatus, type OwnerDeal } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { pickImages, uploadFile } from '@/lib/upload';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { Badge, Button, Card, EmptyState, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { cover } from '@/components/cards';

type Draft = { id?: string; title: string; description: string; terms: string; image_path: string | null };
const tone: Record<DealStatus, 'success' | 'warning' | 'neutral'> = { active: 'success', paused: 'warning', ended: 'neutral' };

/** Business team: post and manage deals, and redeem a customer's code at the counter. */
export default function DealsManager() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { canManage } = useManagedBusiness(businessId);
  const { colors, radius } = useTheme();
  const qc = useQueryClient();
  const deals = useQuery({ queryKey: ['owner-deals', businessId], queryFn: () => api.deals.owner(businessId!), enabled: !!businessId });
  const claims = useQuery({ queryKey: ['deal-claims', businessId], queryFn: () => api.deals.claims(businessId!, 30), enabled: !!businessId });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['owner-deals', businessId] }); qc.invalidateQueries({ queryKey: ['deal-claims', businessId] }); };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = dealSchema.safeParse({ title: draft!.title, description: draft!.description, terms: draft!.terms });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the form');
      const v = parsed.data;
      return api.deals.save({ id: draft!.id, business_id: businessId!, title: v.title, description: v.description || null, terms: v.terms || null, image_path: draft!.image_path, status: 'active' });
    },
    onSuccess: () => { setDraft(null); refresh(); },
    onError: (e) => setError(friendlyError(e)),
  });
  const status = useMutation({ mutationFn: ({ id, s }: { id: string; s: DealStatus }) => api.deals.setStatus(id, s), onSuccess: refresh, onError: (e) => setError(friendlyError(e)) });
  const photo = async () => {
    setError(null);
    try {
      const [f] = await pickImages();
      if (!f) return;
      setUploading(true);
      const path = await uploadFile('business-media', `${businessId}/deals`, f, 'image');
      setDraft((d) => (d ? { ...d, image_path: path } : d));
    } catch (e) { setError(friendlyError(e)); } finally { setUploading(false); }
  };
  const edit = (d?: OwnerDeal) => { setError(null); setDraft(d ? { id: d.id, title: d.title, description: d.description ?? '', terms: d.terms ?? '', image_path: d.image_path } : { title: '', description: '', terms: '', image_path: null }); };
  const rows = deals.data ?? [];

  return (
    <Screen header={<Header title="Deals" right={canManage && !draft ? <Button title="New" size="sm" icon="add" onPress={() => edit()} /> : undefined} />} keyboard refreshing={deals.isRefetching} onRefresh={refresh}>
      <RedeemCard businessId={businessId!} onDone={refresh} />

      {draft && (
        <Card style={{ marginTop: 12 }}>
          <Text variant="subheading" style={{ marginBottom: 12 }}>{draft.id ? 'Edit deal' : 'New deal'}</Text>
          <Input label="Title" value={draft.title} onChangeText={(t) => setDraft({ ...draft, title: t })} maxLength={80} placeholder="e.g. 10% off any combo platter" hint="Say exactly what the customer gets." />
          <Input label="Details (optional)" value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} maxLength={1000} multiline />
          <Input label="Conditions (optional)" value={draft.terms} onChangeText={(t) => setDraft({ ...draft, terms: t })} maxLength={500} placeholder="e.g. Dine-in only" />
          <Pressable onPress={photo} accessibilityRole="button" accessibilityLabel="Add a photo" style={{ height: 140, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }}>
            {draft.image_path ? <Image source={{ uri: cover('business-media', draft.image_path)! }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text color="muted">{uploading ? 'Uploading…' : '+ Add a photo (optional)'}</Text>}
          </Pressable>
          {!draft.id && <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Posting makes the deal live on your page and in Deals. Members who saved your business get a notification. Each member can claim it once.</Text>}
          {error && <Text variant="caption" color="danger" style={{ marginBottom: 12 }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="ghost" onPress={() => setDraft(null)} />
            <Button title={draft.id ? 'Save changes' : 'Post deal'} style={{ flex: 1 }} loading={save.isPending} disabled={uploading} onPress={() => save.mutate()} />
          </View>
        </Card>
      )}
      {!draft && error && <Text variant="caption" color="danger" style={{ marginTop: 8 }}>{error}</Text>}

      <Text variant="overline" color="muted" style={{ marginTop: 20, marginBottom: 8 }}>Your deals</Text>
      {deals.isLoading ? <Loading /> : !rows.length ? (
        <EmptyState icon="pricetags-outline" title="No deals yet" body="A simple offer — a free coffee with any meal, 10% off on weekdays — gives people a reason to visit and to come back." action={canManage ? 'Post your first deal' : undefined} onAction={canManage ? () => edit() : undefined} />
      ) : rows.map((d) => (
        <Card key={d.id} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{d.title}</Text>
              <Text variant="caption" color="muted">{d.claims_count} claimed · {d.redeemed_count} used</Text>
            </View>
            <Badge label={dealStatusLabels[d.status]} tone={tone[d.status]} />
          </View>
          {d.status === 'paused' && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Hidden and not claimable. Codes already claimed still work.</Text>}
          {canManage && d.status !== 'ended' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button title="Edit" size="sm" variant="outline" onPress={() => edit(d)} />
              <Button title={d.status === 'active' ? 'Pause' : 'Resume'} size="sm" variant="outline" onPress={() => status.mutate({ id: d.id, s: d.status === 'active' ? 'paused' : 'active' })} />
              <Button title="End" size="sm" variant="ghost" onPress={() => Alert.alert('End this deal?', 'It disappears from Adey and its codes stop working. You can post a new deal any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End deal', style: 'destructive', onPress: () => status.mutate({ id: d.id, s: 'ended' }) }])} />
            </View>
          )}
        </Card>
      ))}

      <Text variant="overline" color="muted" style={{ marginTop: 20, marginBottom: 8 }}>Recent claims</Text>
      <Card padded={false}>
        {!claims.data?.length ? <Text color="muted" style={{ padding: 14 }}>{claims.isLoading ? 'Loading…' : 'Claims appear here as customers claim your deals.'}</Text> : claims.data.map((c, i) => (
          <View key={c.id} style={{ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Text variant="label">{c.customer_name}</Text><Text variant="caption" color="muted" numberOfLines={1}>{c.deal_title}</Text></View>
            <Badge label={c.redeemed_at ? 'Used' : 'Not used yet'} tone={c.redeemed_at ? 'success' : 'neutral'} />
          </View>
        ))}
      </Card>
      <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Names follow each member’s privacy setting.</Text>
    </Screen>
  );
}

function RedeemCard({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<DealRedeemResult | null>(null);
  const go = useMutation({ mutationFn: () => api.deals.redeem(businessId, code), onSuccess: (r) => { setResult(r); if (r.result === 'redeemed') { setCode(''); onDone(); } } });
  const ok = result?.result === 'redeemed';
  return (
    <Card>
      <Text variant="subheading">Redeem a code</Text>
      <Text variant="caption" color="muted" style={{ marginBottom: 8 }}>Type the code the customer shows you.</Text>
      <Input value={code} onChangeText={(t) => { setCode(t.toUpperCase()); setResult(null); }} placeholder="K7QM-3XRP" autoCapitalize="characters" autoCorrect={false} maxLength={12} style={{ fontSize: 20, letterSpacing: 3 }} />
      <Button title="Redeem" icon="checkmark-circle-outline" loading={go.isPending} disabled={!code.trim()} onPress={() => go.mutate()} />
      {go.error && <Text variant="caption" color="danger" style={{ marginTop: 8 }}>{friendlyError(go.error)}</Text>}
      {result && (
        <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: ok ? colors.primarySoft : colors.surfaceMuted }} accessibilityLiveRegion="polite">
          <Text variant="label" color={ok ? 'primary' : 'text'}>{dealRedeemMessages[result.result]}</Text>
          {result.deal_title ? <Text variant="caption">{result.deal_title} · {result.customer_name}</Text> : null}
        </View>
      )}
    </Card>
  );
}
