import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { eventCategoryLabels, type EventCard, type EventCategory } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { Badge, Text } from '@/components/ui';

export const eventCoverUrl = (path: string | null | undefined) => api.storage.publicUrl('event-media', path);

/** Date/time in the event's own timezone; falls back to the device zone when the zone name is unknown. */
export function fmtEventTime(iso: string | null | undefined, tz: string | null | undefined, opts: Intl.DateTimeFormatOptions) {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    return d.toLocaleString(undefined, { ...opts, timeZone: tz || undefined });
  } catch {
    return d.toLocaleString(undefined, opts);
  }
}

export function eventWhen(e: { starts_at: string | null; ends_at?: string | null; timezone: string | null; all_day: boolean | null }, withZone = false) {
  const day: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', ...(withZone ? { timeZoneName: 'short' as const } : {}) };
  if (!e.starts_at) return '';
  if (e.all_day) return fmtEventTime(e.starts_at, e.timezone, day) + ' · All day';
  const start = `${fmtEventTime(e.starts_at, e.timezone, day)} · ${fmtEventTime(e.starts_at, e.timezone, time)}`;
  if (!e.ends_at) return start;
  const sameDay = fmtEventTime(e.starts_at, e.timezone, day) === fmtEventTime(e.ends_at, e.timezone, day);
  return sameDay ? `${start} – ${fmtEventTime(e.ends_at, e.timezone, { hour: 'numeric', minute: '2-digit' })}` : `${start} → ${fmtEventTime(e.ends_at, e.timezone, day)} ${fmtEventTime(e.ends_at, e.timezone, { hour: 'numeric', minute: '2-digit' })}`;
}

export const rsvpLabel = (s: string | null | undefined) => (s === 'going' ? "You're going" : s === 'interested' ? 'Interested' : null);

export function EventListCard({ e }: { e: EventCard }) {
  const { colors, radius } = useTheme();
  const cover = eventCoverUrl(e.cover_path);
  const where = e.is_online ? 'Online' : [e.venue_name, e.city].filter(Boolean).join(', ');
  const rsvp = rsvpLabel(e.my_rsvp);
  const counts = [e.going_count ? `${e.going_count} going` : null, e.interested_count ? `${e.interested_count} interested` : null].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => router.push(`/events/${e.slug ?? e.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${e.title}, ${eventWhen(e)}${where ? ', ' + where : ''}`}
      style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden', opacity: pressed ? 0.92 : 1 })}
    >
      {cover && <Image source={{ uri: cover }} style={{ width: '100%', height: 140, backgroundColor: colors.skeleton }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />}
      <View style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
          {e.category && <Badge label={eventCategoryLabels[e.category as EventCategory]} tone="primary" />}
          <Badge label={e.is_free ? 'Free' : e.price_note || 'Tickets'} tone={e.is_free ? 'success' : 'neutral'} />
          {rsvp && <Badge label={rsvp} tone="accent" icon="checkmark-circle" />}
        </View>
        <Text variant="bodyStrong" numberOfLines={2}>{e.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" color="muted" style={{ flex: 1 }}>{eventWhen(e)}</Text>
        </View>
        {!!where && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={e.is_online ? 'globe-outline' : 'location-outline'} size={14} color={colors.textMuted} />
            <Text variant="caption" color="muted" style={{ flex: 1 }} numberOfLines={1}>{where}{e.distance_km != null ? ` · ${Math.round(e.distance_km)} km` : ''}</Text>
          </View>
        )}
        {(e.organizer_business_name || e.organizer_name) && <Text variant="caption" color="muted" numberOfLines={1}>By {e.organizer_business_name || e.organizer_name}</Text>}
        {!!counts && <Text variant="caption" color="muted">{counts}</Text>}
      </View>
    </Pressable>
  );
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Month grid built by hand (no calendar package). `marked` holds YYYY-MM-DD keys that have events. */
export function MonthGrid({ year, month, marked, selected, onSelect, onPrev, onNext }: {
  year: number; month: number; marked: Set<string>; selected: string | null; onSelect: (key: string | null) => void; onPrev: () => void; onNext: () => void;
}) {
  const { colors, radius } = useTheme();
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = dayKey(new Date());
  const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel="Previous month" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
        <Text variant="subheading" accessibilityRole="header">{title}</Text>
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Next month" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={22} color={colors.text} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {DOW.map((d, i) => <Text key={i} variant="caption" color="muted" center style={{ flex: 1 }}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={{ flexDirection: 'row' }}>
          {cells.slice(w * 7, w * 7 + 7).map((n, i) => {
            if (!n) return <View key={i} style={{ flex: 1, height: 44 }} />;
            const key = dayKey(new Date(year, month, n));
            const on = selected === key;
            const has = marked.has(key);
            return (
              <Pressable
                key={i}
                onPress={() => onSelect(on ? null : key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${new Date(year, month, n).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${has ? ', has events' : ''}`}
                style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : 'transparent', borderWidth: key === today && !on ? 1.5 : 0, borderColor: colors.primary }}>
                  <Text variant="label" style={{ color: on ? colors.onPrimary : colors.text }}>{n}</Text>
                  {has && <View style={{ position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: on ? colors.onPrimary : colors.accent }} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
