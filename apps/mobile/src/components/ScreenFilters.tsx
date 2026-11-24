import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Category, Database } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import type { UserLocation } from '@/lib/location';
import { Button, Chip, Text } from '@/components/ui';

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
const SORTS: [Filters['sort'], string][] = [['relevance', 'Recommended'], ['distance', 'Nearest'], ['price_asc', 'Lowest price'], ['rating', 'Top rated']];

export function ScreenFilters({ visible, value, onChange, onClose, categories }: { visible: boolean; value: Filters; onChange: (f: Filters) => void; onClose: () => void; categories: Category[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.head, { borderBottomColor: colors.border, paddingTop: 16 }]}>
          <Button title="Reset" variant="ghost" size="sm" onPress={() => onChange({ ...defaultFilters, q: value.q })} />
          <Text variant="subheading">Filters</Text>
          <Button title="Show screens" size="sm" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 22 }}>
          <Section title="Type of business">
            <Row>
              <Chip small label="All" selected={!value.categoryId} onPress={() => set('categoryId', null)} />
              {categories.map((c) => <Chip key={c.id} small label={c.name_en} selected={value.categoryId === c.id} onPress={() => set('categoryId', value.categoryId === c.id ? null : c.id)} />)}
            </Row>
          </Section>
          <Section title="Distance">
            <Row>{[15, 50, 120, null].map((r) => <Chip key={String(r)} small label={r ? `Within ${r} km` : 'Any distance'} selected={value.radiusKm === r} onPress={() => set('radiusKm', r)} />)}</Row>
          </Section>
          <Section title="Budget for 30 days">
            <Row>
              <Chip small label="Any price" selected={value.priceMax == null} onPress={() => set('priceMax', null)} />
              {PRICE_PRESETS.map((p) => <Chip key={p} small label={`Up to $${p}`} selected={value.priceMax === p} onPress={() => set('priceMax', p)} />)}
            </Row>
          </Section>
          <Section title="Sort by">
            <Row>{SORTS.map(([v, l]) => <Chip key={v} small label={l} selected={value.sort === v} onPress={() => set('sort', v)} />)}</Row>
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
