import React, { useState } from 'react';
import { Linking, Platform, Pressable, Share, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventCategoryLabels, friendlyError, type RsvpStatus } from '@adey/shared';
import { api, WEB_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { openDirections, openWebsite } from '@/lib/actions';
import { Badge, Button, Card, EmptyState, ErrorState, Header, IconButton, Loading, Screen, Text } from '@/components/ui';
import { eventCoverUrl, eventWhen } from '@/components/community/events';

const gcal = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api.events.get(id) });
  const e = q.data;
  const rsvpQ = useQuery({ queryKey: ['event-rsvp', e?.id, user?.id], queryFn: () => api.events.myRsvp(e!.id), enabled: !!e && !!user });
  const [counts, setCounts] = useState<{ going: number; interested: number } | null>(null);
  const rsvp = useMutation({
    mutationFn: (s: RsvpStatus | 'none') => api.events.rsvp(e!.id, s),
    onSuccess: (r) => {
      setErr(null);
      setCounts({ going: r.going_count, interested: r.interested_count });
      qc.setQueryData(['event-rsvp', e?.id, user?.id], r.my_rsvp);
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (x) => setErr(friendlyError(x)),
  });

  if (q.isLoading) return <Screen header={<Header title="Event" />}><Loading /></Screen>;
  if (q.isError) return <Screen header={<Header title="Event" />}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  if (!e) return <Screen header={<Header title="Event" />}><EmptyState icon="calendar-outline" title="Event not found" body="It may have been removed or is not published yet." /></Screen>;

  const cover = eventCoverUrl(e.cover_path);
  const my = rsvpQ.data ?? null;
  const going = counts?.going ?? e.going_count;
  const interested = counts?.interested ?? e.interested_count;
  const isOwner = user?.id === e.created_by;
  const published = e.status === 'published';
  const past = new Date(e.ends_at ?? e.starts_at).getTime() < now;
  const address = [e.venue_name, e.address_line1, e.city, e.state, e.postal_code].filter(Boolean).join(', ');
  const url = `${WEB_URL}/events/${e.slug || e.id}`;
  const share = () => Share.share(Platform.OS === 'ios' ? { message: e.title, url } : { message: `${e.title} — ${url}` }).catch(() => {});
  const addToCalendar = () => {
    const start = new Date(e.starts_at);
    const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 2 * 3600_000);
    const link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${gcal(start)}/${gcal(end)}&details=${encodeURIComponent(`${e.description ?? ''}\n${url}`.trim())}&location=${encodeURIComponent(e.is_online ? e.online_url ?? 'Online' : address)}`;
    Linking.openURL(link).catch(() => setErr('Could not open your calendar.'));
  };
  const set = (s: RsvpStatus) => {
    if (!user) return router.push('/(auth)/sign-in');
    rsvp.mutate(my === s ? 'none' : s);
  };

  return (
    <Screen header={<Header title="Event" right={<IconButton icon="share-outline" accessibilityLabel="Share event" onPress={share} />} />}>
      {cover && <Image source={{ uri: cover }} style={{ width: '100%', height: 200, borderRadius: 16, backgroundColor: colors.skeleton, marginBottom: 14 }} contentFit="cover" accessibilityIgnoresInvertColors />}
      {isOwner && !published && (
        <Card style={{ marginBottom: 12 }}>
          <Text variant="bodyStrong">{e.status === 'pending' ? 'Waiting for review' : e.status === 'rejected' ? 'Not approved' : e.status === 'cancelled' ? 'Cancelled' : 'Draft'}</Text>
          <Text variant="caption" color="muted">{e.status === 'rejected' && e.rejection_reason ? e.rejection_reason : 'Only you can see this event until it is published.'}</Text>
          <Button title="Edit event" variant="secondary" size="sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => router.push(`/events/edit/${e.id}`)} />
        </Card>
      )}
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <Badge label={eventCategoryLabels[e.category]} tone="primary" />
        <Badge label={e.is_free ? 'Free' : e.price_note || 'Tickets'} tone={e.is_free ? 'success' : 'neutral'} />
        {e.is_online && <Badge label="Online" tone="info" icon="globe-outline" />}
        {past && <Badge label="Ended" tone="neutral" />}
      </View>
      <Text variant="heading" accessibilityRole="header">{e.title}</Text>
      {!!e.title_am && <Text color="muted">{e.title_am}</Text>}

      <Card style={{ marginTop: 14, gap: 12 }}>
        <Row icon="time-outline" text={eventWhen(e, true)} sub={e.timezone} />
        {e.is_online ? (
          <Row icon="globe-outline" text="Online event" sub={e.online_url ?? undefined} onPress={e.online_url ? () => openWebsite(e.online_url!) : undefined} />
        ) : (
          !!address && <Row icon="location-outline" text={address} sub="Open in Maps" onPress={() => openDirections({ lat: e.lat, lng: e.lng, address, label: e.venue_name ?? e.title })} />
        )}
        <Row icon="people-outline" text={`${going} going · ${interested} interested`} />
      </Card>

      {published && !past && (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={my === 'going' ? "I'm going" : 'Going'} icon={my === 'going' ? 'checkmark-circle' : 'checkmark-circle-outline'} variant={my === 'going' ? 'primary' : 'secondary'} style={{ flex: 1 }} loading={rsvp.isPending} onPress={() => set('going')} accessibilityState={{ selected: my === 'going' }} />
            <Button title={my === 'interested' ? 'Interested' : 'Interested?'} icon={my === 'interested' ? 'star' : 'star-outline'} variant={my === 'interested' ? 'primary' : 'secondary'} style={{ flex: 1 }} loading={rsvp.isPending} onPress={() => set('interested')} accessibilityState={{ selected: my === 'interested' }} />
          </View>
          {!!my && <Button title="Remove my RSVP" variant="ghost" size="sm" onPress={() => rsvp.mutate('none')} />}
          <Button title="Add to calendar" icon="calendar-outline" variant="outline" style={{ marginTop: 8 }} fullWidth onPress={addToCalendar} />
        </View>
      )}
      {!!err && <Text color="danger" variant="caption" style={{ marginTop: 8 }}>{err}</Text>}

      {!!e.ticket_url && <Button title="Tickets / more info" icon="ticket-outline" style={{ marginTop: 10 }} fullWidth onPress={() => openWebsite(e.ticket_url!)} />}

      {!!e.description && (
        <>
          <Text variant="subheading" style={{ marginTop: 20, marginBottom: 6 }}>About</Text>
          <Text>{e.description}</Text>
        </>
      )}

      {(e.organizer_name || e.business) && (
        <>
          <Text variant="subheading" style={{ marginTop: 20, marginBottom: 6 }}>Organiser</Text>
          <Card onPress={e.business ? () => router.push(`/business/${e.business!.slug}`) : undefined} accessibilityLabel={`Organiser ${e.business?.name ?? e.organizer_name}`}>
            <Text variant="bodyStrong">{e.business?.name ?? e.organizer_name}</Text>
            {!!e.business && <Text variant="caption" color="primary">View business</Text>}
            {!!e.contact_email && <Text variant="caption" color="muted" style={{ marginTop: 4 }}>{e.contact_email}</Text>}
            {!!e.contact_phone && <Text variant="caption" color="muted">{e.contact_phone}</Text>}
          </Card>
        </>
      )}
      <Text variant="caption" color="muted" style={{ marginTop: 16 }}>Community events are submitted by members and reviewed by Adey. Check details with the organiser before you travel.</Text>
    </Screen>
  );
}

function Row({ icon, text, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; text: string; sub?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={colors.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{text}</Text>
        {!!sub && <Text variant="caption" color={onPress ? 'primary' : 'muted'}>{sub}</Text>}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </View>
  );
  return onPress ? <TapRow onPress={onPress} label={text}>{body}</TapRow> : body;
}

function TapRow({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minHeight: 44, justifyContent: 'center' })}>{children}</Pressable>;
}
