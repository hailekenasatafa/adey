import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { eventCategoryLabels, friendlyError, type EventCategory } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location';
import { Chip, EmptyState, IconButton, Loading, Text, Screen } from '@/components/ui';
import { dayKey, EventListCard, MonthGrid } from '@/components/community/events';
import { EventSubscribe } from '@/components/community/EventSubscribe';

export default function EventsTab() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { location } = useLocation();
  const params = useLocalSearchParams<{ mine?: string }>();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [day, setDay] = useState<string | null>(null);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [free, setFree] = useState(false);
  const [online, setOnline] = useState(false);
  const [near, setNear] = useState(false);
  const [mineState, setMine] = useState(false);
  const mine = mineState || (params.mine === '1' && !!user);
  const [region, setRegion] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const regionsQ = useQuery({ queryKey: ['settings', 'events'], queryFn: () => api.settings.get<{ regions?: Record<string, { name: string }> }>('events'), staleTime: 600_000 });
  const regions = Object.entries(regionsQ.data?.regions ?? {});
  const canQ = useQuery({ queryKey: ['events', 'can-submit', user?.id], queryFn: () => api.events.canSubmit(), enabled: !!user });
  const canPost = !!canQ.data?.allowed;

  const current = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const from = current ? now.toISOString() : new Date(ym.y, ym.m, 1).toISOString();
  const to = new Date(ym.y, ym.m + 1, 1).toISOString();
  const q = useQuery({
    queryKey: ['events', 'month', ym, current, category, free, online, near && location.lat, mine, user?.id, region, tag],
    queryFn: () => api.events.search({
      p_from: from, p_to: to, p_category: category ?? undefined, p_free_only: free || undefined, p_online: online || undefined,
      p_lat: near ? location.lat : undefined, p_lng: near ? location.lng : undefined, p_radius_km: near ? 50 : undefined,
      p_mine: mine || undefined, p_region: region ?? undefined, p_tag: tag ?? undefined, p_limit: 100,
    }),
  });

  const items = useMemo(() => q.data ?? [], [q.data]);
  const marked = useMemo(() => new Set(items.filter((e) => e.starts_at).map((e) => dayKey(new Date(e.starts_at!)))), [items]);
  const shown = day ? items.filter((e) => e.starts_at && dayKey(new Date(e.starts_at)) === day) : items;
  const step = (d: number) => { const t = new Date(ym.y, ym.m + d, 1); setYm({ y: t.getFullYear(), m: t.getMonth() }); setDay(null); };
  const needSignIn = () => router.push('/(auth)/sign-in');

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title">Events</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="list-outline" accessibilityLabel="My submitted events" onPress={() => (user ? router.push('/events/mine') : needSignIn())} />
          {(!user || canPost) && <IconButton icon="add" accessibilityLabel="Submit an event" bg={undefined} onPress={() => (user ? router.push('/events/new') : needSignIn())} />}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        <Chip label="Everywhere" icon="earth-outline" selected={!region} onPress={() => setRegion(null)} />
        {regions.map(([k, r]) => <Chip key={k} label={r.name} icon="map-outline" selected={region === k} onPress={() => setRegion(region === k ? null : k)} />)}
      </ScrollView>
      {!!tag && <View style={{ flexDirection: 'row' }}><Chip label={`#${tag}`} icon="close" selected onPress={() => setTag(null)} /></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        <Chip label="Free" icon="pricetag-outline" selected={free} onPress={() => setFree(!free)} />
        <Chip label="Online" icon="globe-outline" selected={online} onPress={() => setOnline(!online)} />
        <Chip label={`Near ${location.label}`} icon="navigate-outline" selected={near} onPress={() => setNear(!near)} />
        <Chip label="My events" icon="person-outline" selected={mine} onPress={() => (user ? setMine(!mine) : needSignIn())} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All categories" small selected={!category} onPress={() => setCategory(null)} />
        {(Object.keys(eventCategoryLabels) as EventCategory[]).map((c) => <Chip key={c} small label={eventCategoryLabels[c]} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />)}
      </ScrollView>
      <EventSubscribe region={region} category={category} tag={tag} />
      <MonthGrid year={ym.y} month={ym.m} marked={marked} selected={day} onSelect={setDay} onPrev={() => step(-1)} onNext={() => step(1)} />
      <Text variant="subheading">{day ? new Date(day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : current ? 'Upcoming this month' : new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
    </View>
  );

  return (
    <Screen padded={false} scroll={false}>
      <FlatList
        data={shown}
        keyExtractor={(e, i) => e.id ?? String(i)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 32, gap: 10 }}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => <EventListCard e={item} tag={tag} onTag={(t) => { setTag(tag === t ? null : t); setDay(null); }} />}
        ListEmptyComponent={
          q.isLoading ? <Loading /> : q.isError ? (
            <EmptyState icon="alert-circle-outline" title="Couldn't load events" body={friendlyError(q.error)} action="Try again" onAction={() => q.refetch()} />
          ) : (
            <EmptyState icon="calendar-outline" title={day ? 'Nothing on this day' : 'No events found'} body={mine ? 'Events you are going to or interested in appear here.' : 'Try another month, region or tag, or clear a filter.'} />
          )
        }
      />
    </Screen>
  );
}
