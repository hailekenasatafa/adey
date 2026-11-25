import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, eventCategoryLabels, eventSchema, friendlyError, type CommunityEvent, type EventCategory } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { pickImages, uploadFile } from '@/lib/upload';
import { Button, Card, Chip, Header, Input, Screen, Text } from '@/components/ui';
import { CountryPicker } from './CountryPicker';
import { ToggleRow } from './controls';
import { eventCoverUrl } from './events';

const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

function parts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}
/** "2026-12-05" + "18:30" typed in `tz` -> ISO instant (null when the text is not a valid date/time). */
export function zonedToIso(date: string, time: string, tz: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim() || '00:00');
  if (!dm || !tm) return null;
  const [y, mo, d, h, mi] = [+dm[1], +dm[2], +dm[3], +tm[1], +tm[2]];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(guess).getUTCMonth() !== mo - 1 || h > 23 || mi > 59) return null;
  const p = parts(guess, tz);
  const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - guess;
  return new Date(guess - offset).toISOString();
}
function isoToZoned(iso: string | null | undefined, tz: string) {
  if (!iso) return { date: '', time: '' };
  const p = parts(new Date(iso).getTime(), tz);
  const z = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.y}-${z(p.mo)}-${z(p.d)}`, time: `${z(p.h)}:${z(p.mi)}` };
}

export function EventForm({ existing }: { existing?: CommunityEvent }) {
  const { colors } = useTheme();
  const { user, businesses } = useAuth();
  const qc = useQueryClient();
  const tz0 = existing?.timezone ?? deviceTz();
  const s0 = isoToZoned(existing?.starts_at, tz0);
  const e0 = isoToZoned(existing?.ends_at, tz0);
  const [f, setF] = useState({
    title: existing?.title ?? '', title_am: existing?.title_am ?? '', description: existing?.description ?? '',
    category: (existing?.category ?? 'community') as EventCategory, timezone: tz0, all_day: existing?.all_day ?? false,
    sDate: s0.date, sTime: s0.time, eDate: e0.date, eTime: e0.time,
    is_online: existing?.is_online ?? false, online_url: existing?.online_url ?? '', venue_name: existing?.venue_name ?? '', address_line1: existing?.address_line1 ?? '',
    city: existing?.city ?? '', state: existing?.state ?? '', postal_code: existing?.postal_code ?? '', country: existing?.country ?? 'US',
    is_free: existing?.is_free ?? true, price_note: existing?.price_note ?? '', ticket_url: existing?.ticket_url ?? '',
    organizer_name: existing?.organizer_name ?? '', organizer_business_id: existing?.organizer_business_id ?? null as string | null,
    contact_email: existing?.contact_email ?? '', contact_phone: existing?.contact_phone ?? '',
  });
  const canQ = useQuery({ queryKey: ['events', 'can-submit', user?.id], queryFn: () => api.events.canSubmit(), enabled: !!user });
  const verifiedOnly = canQ.data?.mode === 'verified_businesses';
  const orgs = verifiedOnly ? (canQ.data?.businesses ?? []).filter((b) => b.verified) : businesses.map((b) => ({ id: b.id, name: b.name }));
  const [tagText, setTagText] = useState((existing?.tags ?? []).join(', '));
  const orgId = f.organizer_business_id ?? (verifiedOnly && !existing ? orgs[0]?.id ?? null : null);
  const [cover, setCover] = useState<string | null>(existing?.cover_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: (input: Parameters<typeof api.events.save>[0]) => api.events.save(input),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event'] });
      qc.invalidateQueries({ queryKey: ['my-events'] });
      const msg = row.status === 'published' ? 'Your event is published.' : row.status === 'pending' ? 'Thanks. Your event was submitted and will appear after a quick review by the Adey Connect team.' : 'Your event was saved.';
      Alert.alert(existing ? 'Event updated' : 'Event submitted', msg);
      router.replace('/events/mine');
    },
    onError: (e) => setBanner(friendlyError(e)),
  });

  const changeCover = async () => {
    try {
      const [file] = await pickImages();
      if (!file || !user) return;
      setUploading(true);
      setCover(await uploadFile('event-media', user.id, file, 'image'));
    } catch (e) {
      setBanner(friendlyError(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    setBanner(null);
    const errs: Record<string, string> = {};
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    try {
      startsAt = zonedToIso(f.sDate, f.all_day ? '00:00' : f.sTime, f.timezone);
      if (f.eDate.trim()) endsAt = zonedToIso(f.eDate, f.all_day ? '23:59' : f.eTime || '23:59', f.timezone);
    } catch {
      errs.timezone = 'Unknown timezone. Use a name like America/New_York.';
    }
    if (!startsAt && !errs.timezone) errs.sDate = 'Enter the start date as YYYY-MM-DD and time as HH:MM';
    if (f.eDate.trim() && !endsAt && !errs.timezone) errs.eDate = 'Enter the end date as YYYY-MM-DD and time as HH:MM';
    const parsed = eventSchema.safeParse({
      title: f.title, title_am: f.title_am, description: f.description, category: f.category, starts_at: startsAt ?? '', ends_at: endsAt, timezone: f.timezone, all_day: f.all_day,
      venue_name: f.venue_name, address_line1: f.address_line1, city: f.city, state: f.state, postal_code: f.postal_code, country: f.country,
      is_online: f.is_online, online_url: f.online_url, is_free: f.is_free, price_note: f.price_note, ticket_url: f.ticket_url,
      organizer_name: f.organizer_name, organizer_business_id: orgId, contact_email: f.contact_email, contact_phone: f.contact_phone,
      tags: tagText.split(',').map((t) => t.trim()).filter(Boolean),
    });
    if (verifiedOnly && !orgId) errs.organizer_business_id = 'Choose one of your verified businesses as the organiser';
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
    if (f.is_online && !f.online_url.trim()) errs.online_url = 'Add the link people use to join';
    if (!parsed.success || Object.keys(errs).length) {
      setErrors(errs);
      setBanner('Please fix the highlighted fields.');
      return;
    }
    setErrors({});
    const d = parsed.data;
    const { starts_at, ends_at, ...rest } = blankToNull(d);
    save.mutate({ ...(existing ? { id: existing.id } : {}), ...rest, starts_at: starts_at as string, ends_at: (ends_at as string | null) ?? null, cover_path: cover } as Parameters<typeof api.events.save>[0]);
  };

  const field = (k: keyof typeof errors | string) => errors[k];
  const text = (k: keyof typeof f, label: string, extra: object = {}) => (
    <Input label={label} value={String(f[k] ?? '')} onChangeText={(v) => set(k, v as never)} error={field(k as string)} {...extra} />
  );
  const cur = eventCoverUrl(cover);

  return (
    <Screen header={<Header title={existing ? 'Edit event' : 'Add an event'} />} keyboard>
      <Card style={{ marginBottom: 16 }}>
        <Text variant="caption" color="muted">{verifiedOnly ? 'Only verified businesses can post events. Your event may be reviewed by the Adey Connect team before it appears in the calendar.' : 'Events from verified businesses are published right away. Everything else is reviewed by the Adey Connect team before it appears in the calendar.'}</Text>
      </Card>

      <Pressable onPress={changeCover} accessibilityRole="button" accessibilityLabel={cover ? 'Change cover photo' : 'Add a cover photo'} style={{ height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        {cur ? <Image source={{ uri: cur }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors /> : <Text color="muted">{uploading ? 'Uploading…' : 'Tap to add a cover photo'}</Text>}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Button title={uploading ? 'Uploading…' : cover ? 'Change photo' : 'Add photo'} size="sm" variant="secondary" loading={uploading} onPress={changeCover} />
        {!!cover && <Button title="Remove" size="sm" variant="ghost" onPress={() => setCover(null)} />}
      </View>

      {text('title', 'Title', { maxLength: 140 })}
      {text('title_am', 'Title in Amharic (optional)', { maxLength: 140 })}
      {text('description', 'Description', { multiline: true, maxLength: 6000 })}
      <Input label="Tags (optional)" value={tagText} onChangeText={setTagText} error={field('tags')} placeholder="live music, timket, food" autoCapitalize="none" hint="Separate with commas. Up to 12." />
      <Text variant="label" style={{ marginBottom: 8 }}>Category</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {(Object.keys(eventCategoryLabels) as EventCategory[]).map((c) => <Chip key={c} small label={eventCategoryLabels[c]} selected={f.category === c} onPress={() => set('category', c)} />)}
      </View>

      <Text variant="subheading" style={{ marginBottom: 8 }}>When</Text>
      <ToggleRow label="All day" value={f.all_day} onChange={(v) => set('all_day', v)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 3 }}>{text('sDate', 'Start date', { placeholder: 'YYYY-MM-DD', keyboardType: 'numbers-and-punctuation', autoCorrect: false })}</View>
        {!f.all_day && <View style={{ flex: 2 }}>{text('sTime', 'Start time', { placeholder: 'HH:MM', keyboardType: 'numbers-and-punctuation' })}</View>}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 3 }}>{text('eDate', 'End date (optional)', { placeholder: 'YYYY-MM-DD', keyboardType: 'numbers-and-punctuation', autoCorrect: false })}</View>
        {!f.all_day && <View style={{ flex: 2 }}>{text('eTime', 'End time', { placeholder: 'HH:MM', keyboardType: 'numbers-and-punctuation' })}</View>}
      </View>
      {text('timezone', 'Timezone', { autoCapitalize: 'none', autoCorrect: false, hint: 'Times are entered in this timezone.' })}

      <Text variant="subheading" style={{ marginTop: 8, marginBottom: 4 }}>Where</Text>
      <ToggleRow label="Online event" value={f.is_online} onChange={(v) => set('is_online', v)} />
      {f.is_online && text('online_url', 'Link to join', { placeholder: 'https://', autoCapitalize: 'none', keyboardType: 'url', autoCorrect: false })}
      {text('venue_name', f.is_online ? 'Host / venue (optional)' : 'Venue name')}
      {!f.is_online && text('address_line1', 'Street address')}
      {text('city', f.is_online ? 'City (optional)' : 'City')}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>{text('state', 'State / region')}</View>
        <View style={{ flex: 1 }}>{text('postal_code', 'Postal code')}</View>
      </View>
      <CountryPicker value={f.country} onChange={(c) => set('country', c)} error={field('country')} />

      <Text variant="subheading" style={{ marginTop: 8, marginBottom: 4 }}>Tickets</Text>
      <ToggleRow label="Free to attend" value={f.is_free} onChange={(v) => set('is_free', v)} />
      {!f.is_free && text('price_note', 'Price note', { placeholder: 'e.g. $15 at the door' })}
      {text('ticket_url', 'Ticket or info link (optional)', { placeholder: 'https://', autoCapitalize: 'none', keyboardType: 'url', autoCorrect: false })}

      <Text variant="subheading" style={{ marginTop: 8, marginBottom: 8 }}>Organiser</Text>
      {orgs.length > 0 && (
        <>
          <Text variant="caption" color="muted" style={{ marginBottom: 8 }}>{verifiedOnly ? 'Events are posted by one of your verified businesses.' : 'Organise as one of your businesses (optional).'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {!verifiedOnly && <Chip small label="Myself" selected={!f.organizer_business_id} onPress={() => set('organizer_business_id', null)} />}
            {orgs.map((b) => <Chip key={b.id} small label={b.name} selected={orgId === b.id} onPress={() => set('organizer_business_id', b.id)} />)}
          </View>
          {!!field('organizer_business_id') && <Text color="danger" variant="caption" style={{ marginBottom: 8 }}>{field('organizer_business_id')}</Text>}
        </>
      )}
      {text('organizer_name', 'Organiser name (optional)')}
      {text('contact_email', 'Contact email (optional)', { autoCapitalize: 'none', keyboardType: 'email-address' })}
      {text('contact_phone', 'Contact phone (optional)', { keyboardType: 'phone-pad' })}

      {!!banner && <Text color="danger" variant="caption" style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">{banner}</Text>}
      <Button title={existing ? 'Save changes' : 'Submit event'} size="lg" fullWidth loading={save.isPending} onPress={submit} />
    </Screen>
  );
}
