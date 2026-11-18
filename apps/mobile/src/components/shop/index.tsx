import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { countriesForPicker, countryName, friendlyError, type ReviewableItem } from '@adey/shared';
import { api } from '@/lib/supabase';
import { StarInput } from '@/components/commerce';
import { useTheme } from '@/lib/theme';
import { Button, Card, Input, Text } from '@/components/ui';

/** − n + stepper. `max` null means no limit known on the client (the server still enforces one). */
export function QtyStepper({ value, onChange, min = 1, max, disabled, label = 'Quantity' }: { value: number; onChange: (n: number) => void; min?: number; max?: number | null; disabled?: boolean; label?: string }) {
  const { colors, radius } = useTheme();
  const canDec = !disabled && value > min;
  const canInc = !disabled && (max == null || value < max);
  const btn = (name: 'remove' | 'add', enabled: boolean, next: number, a11y: string) => (
    <Pressable onPress={() => enabled && onChange(next)} disabled={!enabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled: !enabled }}
      style={[styles.stepBtn, { opacity: enabled ? 1 : 0.35 }]}>
      <Ionicons name={name} size={18} color={colors.text} />
    </Pressable>
  );
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={[styles.stepper, { borderColor: colors.border, borderRadius: radius.pill }]}>
      {btn('remove', canDec, value - 1, `Decrease ${label.toLowerCase()}`)}
      <Text variant="label" style={{ minWidth: 28, textAlign: 'center' }}>{value}</Text>
      {btn('add', canInc, value + 1, `Increase ${label.toLowerCase()}`)}
    </View>
  );
}

/** Searchable country picker (featured diaspora countries first). */
export function CountryPicker({ value, onChange, label = 'Country', error }: { value: string | null | undefined; onChange: (code: string) => void; label?: string; error?: string }) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? countriesForPicker.filter((c) => c.name.toLowerCase().includes(t) || c.code.toLowerCase() === t) : countriesForPicker;
  }, [q]);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="label" style={{ marginBottom: 6 }}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? countryName(value) : 'not chosen'}. Change`}
        style={[styles.field, { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface, borderRadius: radius.md }]}>
        <Text style={{ flex: 1 }} color={value ? 'text' : 'muted'}>{value ? countryName(value) : 'Choose a country'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error && <Text variant="caption" color="danger" style={{ marginTop: 6 }}>{error}</Text>}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 8 }}>
          <View style={styles.modalHead}>
            <Text variant="subheading">{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          </View>
          <View style={{ paddingHorizontal: 16 }}><Input placeholder="Search countries" value={q} onChangeText={setQ} icon="search" autoFocus accessibilityLabel="Search countries" /></View>
          <FlatList data={list} keyExtractor={(c) => c.code} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item.code); setOpen(false); setQ(''); }} accessibilityRole="button" accessibilityState={{ selected: item.code === value }}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ flex: 1 }}>{item.name}</Text>
                {item.code === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            )} />
        </View>
      </Modal>
    </View>
  );
}

/** Product review: overall, authenticity and service stars. The server only accepts verified purchases. */
export function ReviewForm({ item, userId, onDone }: { item: Pick<ReviewableItem, 'product_id' | 'business_id' | 'name'> & { order_id?: string | null }; userId: string; onDone: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [auth, setAuth] = useState<number | null>(null);
  const [service, setService] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: () => api.market.addReview({ target_type: 'product', product_id: item.product_id, business_id: item.business_id, order_id: item.order_id ?? null, author_id: userId, rating: rating!, authenticity_rating: auth, service_rating: service, body: body.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-reviews', item.product_id] }); onDone(); },
    onError: (e) => setError(friendlyError(e)),
  });
  return (
    <Card style={{ marginBottom: 10 }}>
      <Text variant="label">{item.name}</Text>
      <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Overall</Text>
      <StarInput value={rating} onChange={setRating} label="Overall rating" size={26} />
      <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Authenticity (optional)</Text>
      <StarInput value={auth} onChange={setAuth} label="Authenticity rating" size={26} />
      <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Seller service (optional)</Text>
      <StarInput value={service} onChange={setService} label="Service rating" size={26} />
      <Input placeholder="What did you think? (optional)" multiline value={body} onChangeText={setBody} maxLength={4000} containerStyle={{ marginTop: 10 }} />
      {error && <Text color="danger" variant="caption" style={{ marginBottom: 8 }}>{error}</Text>}
      <Button title="Post review" size="sm" disabled={!rating} loading={submit.isPending} onPress={() => submit.mutate()} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, alignSelf: 'flex-start' },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, paddingHorizontal: 14, minHeight: 50 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
