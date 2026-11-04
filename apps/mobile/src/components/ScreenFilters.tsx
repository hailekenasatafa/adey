import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category, Database } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import type { UserLocation } from '@/lib/location';
import { addDays, toISODate } from '@/lib/format';
import { Button, Chip, Input, Text } from '@/components/ui';

export type Filters = {
  q: string;
  city: string;
  state: string;
  categoryId: string | null;
  radiusKm: number | null;
  priceMin: number | null;
  priceMax: number | null;
  minSize: number | null;
  minVisitors: number | null;
  verifiedOnly: boolean;
  start: string | null;
  end: string | null;
  sort: 'relevance' | 'distance' | 'price_asc' | 'price_desc' | 'rating' | 'traffic';
};

export const defaultFilters: Filters = { q: '', city: '', state: '', categoryId: null, radiusKm: 50, priceMin: null, priceMax: null, minSize: null, minVisitors: null, verifiedOnly: false, start: null, end: null, sort: 'relevance' };

export function filtersToArgs(f: Filters, loc: UserLocation): Database['public']['Functions']['search_screens']['Args'] {
  return {
    p_query: f.q || undefined, p_city: f.city || undefined, p_state: f.state || undefined, p_category_id: f.categoryId ?? undefined,
    p_lat: loc.lat, p_lng: loc.lng, p_radius_km: f.radiusKm ?? undefined,
    p_price_min_cents: f.priceMin != null ? f.priceMin * 100 : undefined, p_price_max_cents: f.priceMax != null ? f.priceMax * 100 : undefined,
    p_min_size_inches: f.minSize ?? undefined, p_min_daily_visitors: f.minVisitors ?? undefined,
    p_start: f.start ?? undefined, p_end: f.end ?? undefined, p_verified_only: f.verifiedOnly, p_sort: f.sort,
  };
}

const PRICE_PRESETS = [100, 250, 500, 1000];
const SIZE_PRESETS = [32, 43, 55, 65];
const TRAFFIC_PRESETS = [50, 100, 250, 500];

export function ScreenFilters({ visible, value, onChange, onClose, categories }: { visible: boolean; value: Filters; onChange: (f: Filters) => void; onClose: () => void; categories: Category[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const today = toISODate(new Date());
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.head, { borderBottomColor: colors.border, paddingTop: 16 }]}>
          <Button title="Reset" variant="ghost" size="sm" onPress={() => onChange({ ...defaultFilters, q: value.q })} />
          <Text variant="subheading">Filters</Text>
          <Button title="Done" size="sm" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 18 }}>
          <Section title="Location">
            <Input placeholder="City" value={value.city} onChangeText={(t) => set('city', t)} />
            <Input placeholder="State (e.g. MD)" value={value.state} onChangeText={(t) => set('state', t.toUpperCase())} autoCapitalize="characters" maxLength={20} />
            <Row>{[15, 50, 120, null].map((r) => <Chip key={String(r)} small label={r ? `Within ${r} km` : 'Any distance'} selected={value.radiusKm === r} onPress={() => set('radiusKm', r)} />)}</Row>
          </Section>
          <Section title="Business category">
            <Row>{categories.map((c) => <Chip key={c.id} small label={c.name_en} selected={value.categoryId === c.id} onPress={() => set('categoryId', value.categoryId === c.id ? null : c.id)} />)}</Row>
          </Section>
          <Section title="Price (for 30 days, or your dates)">
            <Row>{PRICE_PRESETS.map((p) => <Chip key={p} small label={`≤ $${p}`} selected={value.priceMax === p} onPress={() => set('priceMax', value.priceMax === p ? null : p)} />)}</Row>
          </Section>
          <Section title="Screen size">
            <Row>{SIZE_PRESETS.map((s) => <Chip key={s} small label={`${s}"+`} selected={value.minSize === s} onPress={() => set('minSize', value.minSize === s ? null : s)} />)}</Row>
          </Section>
          <Section title="Estimated daily visitors (owner-reported)">
            <Row>{TRAFFIC_PRESETS.map((t) => <Chip key={t} small label={`${t}+/day`} selected={value.minVisitors === t} onPress={() => set('minVisitors', value.minVisitors === t ? null : t)} />)}</Row>
          </Section>
          <Section title="Availability">
            <Row>
              <Chip small label="Any time" selected={!value.start} onPress={() => { set('start', null); set('end', null); onChange({ ...value, start: null, end: null }); }} />
              {[7, 14, 30].map((d) => <Chip key={d} small label={`Next ${d} days`} selected={value.start === today && value.end === addDays(today, d - 1)} onPress={() => onChange({ ...value, start: today, end: addDays(today, d - 1) })} />)}
            </Row>
            <Text variant="caption" color="muted">Blocks out screens with bookings or owner-blocked dates in that window.</Text>
          </Section>
          <Section title="Trust">
            <Row><Chip small icon="shield-checkmark-outline" label="Verified businesses only" selected={value.verifiedOnly} onPress={() => set('verifiedOnly', !value.verifiedOnly)} /></Row>
          </Section>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 8 }}><Text variant="label">{title}</Text>{children}</View>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

const styles = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth } });
