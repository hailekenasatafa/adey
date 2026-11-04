import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adScreenSchema, formatMoney, friendlyError, hoursSchema, packageSchema, parseMoneyToCents, type AdScreenInput, type Hours } from '@adey/shared';
import { z } from 'zod';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { pickImages, uploadFile } from '@/lib/upload';
import { cover } from '@/components/cards';
import { addDays, fmtDateRange, toISODate } from '@/lib/format';
import { Badge, Button, Card, Chip, FormInput, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { HoursEditor } from '@/components/HoursEditor';

const money = { in: (v: unknown) => (v == null ? '' : (Number(v) / 100).toString()), out: (s: string) => parseMoneyToCents(s) };
const num = { in: (v: unknown) => (v == null ? '' : String(v)), out: (s: string) => (s.trim() ? Number(s) : null) };
type PkgForm = z.infer<typeof packageSchema>;

export default function ScreenEditor() {
  const { screenId, businessId } = useLocalSearchParams<{ screenId: string; businessId: string }>();
  const isNew = screenId === 'new';
  const { colors, radius } = useTheme();
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ['my-screens', businessId], queryFn: () => api.adconnect.myScreens(businessId!), enabled: !isNew && !!businessId });
  const screen = existing.data?.find((s) => s.id === screenId);
  const [images, setImages] = useState<string[]>([]);
  const [hours, setHours] = useState<Hours>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [block, setBlock] = useState<{ start: string; end: string; reason: string } | null>(null);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['my-screens', businessId] }); qc.invalidateQueries({ queryKey: ['screen', screenId] }); qc.invalidateQueries({ queryKey: ['my-businesses'] }); };

  const { control, handleSubmit, watch, setValue, reset } = useForm<AdScreenInput>({
    resolver: zodResolver(adScreenSchema),
    defaultValues: { title: '', description: '', screen_count: 1, screen_size_inches: null, orientation: 'landscape', resolution: '', placement: '', formats: ['video', 'image'], max_video_seconds: 30, estimated_daily_visitors: null, base_price_cents: 0, base_duration_days: 30, min_price_cents: null, status: 'draft' },
  });
  useEffect(() => {
    if (screen) {
      const priv = Array.isArray(screen.private) ? screen.private[0] : screen.private;
      reset({ title: screen.title, description: screen.description ?? '', screen_count: screen.screen_count, screen_size_inches: screen.screen_size_inches, orientation: screen.orientation as 'landscape' | 'portrait' | null, resolution: screen.resolution ?? '', placement: screen.placement ?? '', formats: screen.formats, max_video_seconds: screen.max_video_seconds, estimated_daily_visitors: screen.estimated_daily_visitors, base_price_cents: screen.base_price_cents, base_duration_days: screen.base_duration_days, min_price_cents: priv?.min_price_cents ?? null, status: screen.status });
      setImages(screen.images);
      const h = hoursSchema.safeParse(screen.advertising_hours);
      if (h.success) setHours(h.data);
    }
  }, [screen?.id]);
  const v = watch();

  const save = useMutation({
    mutationFn: async (input: AdScreenInput) => {
      const row = await api.adconnect.upsertScreen({ ...(isNew ? {} : { id: screenId }), business_id: businessId!, title: input.title, description: input.description || null, screen_count: input.screen_count, screen_size_inches: input.screen_size_inches ?? null, orientation: input.orientation ?? null, resolution: input.resolution || null, placement: input.placement || null, formats: input.formats, max_video_seconds: input.max_video_seconds ?? null, estimated_daily_visitors: input.estimated_daily_visitors ?? null, base_price_cents: input.base_price_cents, base_duration_days: input.base_duration_days, status: input.status, images, advertising_hours: hours });
      await api.adconnect.setScreenPrivate(row.id, { min_price_cents: input.min_price_cents ?? null });
      return row;
    },
    onSuccess: (row) => { invalidate(); if (isNew) router.replace({ pathname: '/adconnect/my-screens/[screenId]', params: { screenId: row.id, businessId: businessId! } }); else router.back(); },
    onError: (e) => setError(friendlyError(e)),
  });
  const archive = useMutation({ mutationFn: () => api.adconnect.updateScreen(screenId!, { status: 'archived' }), onSuccess: () => { invalidate(); router.back(); }, onError: (e) => setError(friendlyError(e)) });

  const pkgForm = useForm<PkgForm>({ resolver: zodResolver(packageSchema), defaultValues: { name: '', duration_days: 30, price_cents: 0, plays_per_day: null, spot_seconds: 15, description: '' } });
  const addPkg = useMutation({ mutationFn: (p: PkgForm) => api.adconnect.upsertPackage({ screen_id: screenId, name: p.name, duration_days: p.duration_days, price_cents: p.price_cents, plays_per_day: p.plays_per_day ?? null, spot_seconds: p.spot_seconds ?? null, description: p.description || null, sort_order: screen?.packages?.length ?? 0 }), onSuccess: () => { invalidate(); setPkgOpen(false); pkgForm.reset(); }, onError: (e) => setError(friendlyError(e)) });
  const delPkg = useMutation({ mutationFn: (id: string) => api.adconnect.deletePackage(id), onSuccess: invalidate });
  const blockedQ = useQuery({ queryKey: ['screen', screenId], queryFn: () => api.adconnect.screen(screenId!), enabled: !isNew });
  const addBlock = useMutation({ mutationFn: (b: { start: string; end: string; reason: string }) => api.adconnect.blockDates({ screen_id: screenId, start_date: b.start, end_date: b.end, reason: b.reason || null }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['screen', screenId] }); setBlock(null); }, onError: (e) => setError(friendlyError(e)) });
  const delBlock = useMutation({ mutationFn: (id: string) => api.adconnect.unblockDates(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['screen', screenId] }) });

  const addImages = async () => {
    try {
      const files = await pickImages({ multiple: true });
      if (!files.length) return;
      setBusy(true);
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadFile('screen-media', `${businessId}/screens`, f, 'image'));
      setImages((i) => [...i, ...paths].slice(0, 8));
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  if (!isNew && existing.isLoading) return <Screen header={<Header title="Screen" />}><Loading /></Screen>;
  const today = toISODate(new Date());

  return (
    <Screen header={<Header title={isNew ? 'Add advertising screen' : 'Edit screen'} />} keyboard>
      <Text variant="overline" color="muted" style={{ marginBottom: 8 }}>Photos</Text>
      <View style={styles.images}>
        {images.map((p) => (
          <View key={p} style={[styles.img, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}>
            <Image source={{ uri: cover('screen-media', p)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Pressable onPress={() => setImages((i) => i.filter((x) => x !== p))} style={[styles.del, { backgroundColor: colors.surface }]} accessibilityLabel="Remove"><Ionicons name="close" size={14} color={colors.danger} /></Pressable>
          </View>
        ))}
        {images.length < 8 && <Pressable onPress={addImages} style={[styles.img, { borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel="Add photos"><Ionicons name={busy ? 'hourglass-outline' : 'camera-outline'} size={24} color={colors.primary} /></Pressable>}
      </View>
      <Text variant="caption" color="muted" style={{ marginBottom: 14 }}>Show the screen in context — advertisers want to see where it hangs and how visible it is.</Text>

      <FormInput control={control} name="title" label="Listing title" placeholder='e.g. Dining room 55" TV above the counter' />
      <FormInput control={control} name="placement" label="Placement" placeholder="Where exactly is it? Who sees it?" />
      <FormInput control={control} name="description" label="Description (optional)" multiline />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><FormInput control={control} name="screen_count" label="Number of screens" keyboardType="number-pad" transform={{ in: num.in, out: (s) => Number(s) || 1 }} /></View>
        <View style={{ flex: 1 }}><FormInput control={control} name="screen_size_inches" label="Size (inches)" keyboardType="decimal-pad" transform={num} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Chip small label="Landscape" selected={v.orientation === 'landscape'} onPress={() => setValue('orientation', 'landscape')} />
        <Chip small label="Portrait" selected={v.orientation === 'portrait'} onPress={() => setValue('orientation', 'portrait')} />
      </View>
      <FormInput control={control} name="resolution" label="Resolution (optional)" placeholder="1920x1080" autoCapitalize="none" />
      <Text variant="label" style={{ marginBottom: 8 }}>Accepted ad formats</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {(['video', 'image'] as const).map((f) => <Chip key={f} small label={f} selected={v.formats.includes(f)} onPress={() => setValue('formats', v.formats.includes(f) ? v.formats.filter((x) => x !== f) : [...v.formats, f], { shouldValidate: true })} />)}
      </View>
      {v.formats.includes('video') && <FormInput control={control} name="max_video_seconds" label="Max video length (seconds)" keyboardType="number-pad" transform={num} />}
      <FormInput control={control} name="estimated_daily_visitors" label="Estimated daily visitors (optional)" keyboardType="number-pad" transform={num} hint="Shown to advertisers as your estimate — never as verified impressions." />

      <Text variant="subheading" style={{ marginTop: 10, marginBottom: 10 }}>Pricing</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><FormInput control={control} name="base_price_cents" label="Price (USD)" keyboardType="decimal-pad" transform={money} /></View>
        <View style={{ flex: 1 }}><FormInput control={control} name="base_duration_days" label="for how many days" keyboardType="number-pad" transform={{ in: num.in, out: (s) => Number(s) || 30 }} /></View>
      </View>
      <FormInput control={control} name="min_price_cents" label="Private minimum (optional)" keyboardType="decimal-pad" transform={money} hint="Only you see this. Use it to judge counteroffers quickly." />

      {!isNew && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="label">Packages ({screen?.packages?.length ?? 0})</Text>
            <Button title="Add package" size="sm" variant="secondary" icon="add" onPress={() => setPkgOpen(true)} />
          </View>
          {(screen?.packages ?? []).map((p) => (
            <Card key={p.id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}><Text variant="bodyStrong">{p.name}</Text><Text variant="caption" color="muted">{p.duration_days} days{p.plays_per_day ? ` · ${p.plays_per_day} plays/day` : ''}{p.spot_seconds ? ` · ${p.spot_seconds}s` : ''}</Text></View>
                <Text variant="bodyStrong" color="primary" style={{ marginRight: 10 }}>{formatMoney(p.price_cents)}</Text>
                <Pressable onPress={() => delPkg.mutate(p.id)} hitSlop={8} accessibilityLabel="Delete package"><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
              </View>
            </Card>
          ))}
          {pkgOpen && (
            <Card style={{ marginBottom: 12 }}>
              <FormInput control={pkgForm.control} name="name" label="Package name" placeholder="e.g. Weekend special" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><FormInput control={pkgForm.control} name="duration_days" label="Days" keyboardType="number-pad" transform={{ in: num.in, out: (s) => Number(s) || 1 }} /></View>
                <View style={{ flex: 1 }}><FormInput control={pkgForm.control} name="price_cents" label="Price (USD)" keyboardType="decimal-pad" transform={money} /></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><FormInput control={pkgForm.control} name="plays_per_day" label="Plays / day" keyboardType="number-pad" transform={num} /></View>
                <View style={{ flex: 1 }}><FormInput control={pkgForm.control} name="spot_seconds" label="Spot seconds" keyboardType="number-pad" transform={num} /></View>
              </View>
              <FormInput control={pkgForm.control} name="description" label="Description (optional)" />
              <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Cancel" variant="ghost" onPress={() => setPkgOpen(false)} /><Button title="Save package" style={{ flex: 1 }} loading={addPkg.isPending} onPress={() => pkgForm.handleSubmit((p) => addPkg.mutate(p))()} /></View>
            </Card>
          )}
        </>
      )}

      <Text variant="subheading" style={{ marginTop: 10, marginBottom: 10 }}>Advertising hours</Text>
      <HoursEditor value={hours} onChange={setHours} />

      {!isNew && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 }}>
            <Text variant="label">Blocked dates</Text>
            <Button title="Block dates" size="sm" variant="secondary" icon="calendar-outline" onPress={() => setBlock({ start: today, end: addDays(today, 6), reason: '' })} />
          </View>
          {(blockedQ.data?.blocked ?? []).filter((d) => d.end_date >= today).map((d) => (
            <Card key={d.id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}><Text variant="bodyStrong">{fmtDateRange(d.start_date, d.end_date)}</Text>{d.reason && <Text variant="caption" color="muted">{d.reason}</Text>}</View>
                <Pressable onPress={() => delBlock.mutate(d.id)} hitSlop={8} accessibilityLabel="Unblock"><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
              </View>
            </Card>
          ))}
          {block && (
            <Card style={{ marginBottom: 12 }}>
              <Input label="From (YYYY-MM-DD)" value={block.start} onChangeText={(t) => setBlock({ ...block, start: t })} autoCapitalize="none" />
              <Input label="To (YYYY-MM-DD)" value={block.end} onChangeText={(t) => setBlock({ ...block, end: t })} autoCapitalize="none" />
              <Input label="Reason (optional)" value={block.reason} onChangeText={(t) => setBlock({ ...block, reason: t })} placeholder="e.g. Private event, renovation" />
              <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Cancel" variant="ghost" onPress={() => setBlock(null)} /><Button title="Block" style={{ flex: 1 }} loading={addBlock.isPending} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(block.start) || !/^\d{4}-\d{2}-\d{2}$/.test(block.end) || block.end < block.start} onPress={() => addBlock.mutate(block)} /></View>
            </Card>
          )}
        </>
      )}

      <Text variant="subheading" style={{ marginTop: 10, marginBottom: 10 }}>Listing status</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {(['draft', 'active', 'paused'] as const).map((s) => <Chip key={s} label={s === 'active' ? 'Active (accepting requests)' : s === 'paused' ? 'Paused' : 'Draft (hidden)'} selected={v.status === s} onPress={() => setValue('status', s)} />)}
      </View>
      {v.status === 'active' && <Badge label="Visible to advertisers once your business is published" tone="info" />}
      {error && <Text color="danger" variant="caption" style={{ marginVertical: 12 }}>{error}</Text>}
      <Button title={isNew ? 'Create screen' : 'Save screen'} size="lg" fullWidth style={{ marginTop: 12 }} loading={save.isPending} onPress={() => handleSubmit((d) => save.mutate(d))()} />
      {!isNew && <Button title="Archive listing" variant="ghost" style={{ marginTop: 8 }} onPress={() => Alert.alert('Archive this screen?', 'It will be hidden from advertisers. Existing bookings are unaffected.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => archive.mutate() }])} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  img: { width: 80, height: 80, overflow: 'hidden' },
  del: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
