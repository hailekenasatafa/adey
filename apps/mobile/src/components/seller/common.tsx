import React from 'react';
import { FlatList, Modal, Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { countriesForPicker, countryName, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Card, Chip, EmptyState, Header, Input, Loading, Screen, Text } from '@/components/ui';

/** Permissions the signed-in member holds in this business (from my_access). The database enforces them too. */
export function usePerms(businessId: string | undefined) {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['access', user?.id], queryFn: () => api.account.access(), enabled: !!user, staleTime: 60_000 });
  const perms = q.data?.businesses.find((b) => b.business_id === businessId)?.permissions ?? [];
  return { can: (p: string) => perms.includes(p), loading: q.isLoading, perms };
}

export function useSellerOverview(businessId: string | undefined) {
  return useQuery({ queryKey: ['seller-overview', businessId], queryFn: () => api.seller.overview(businessId!), enabled: !!businessId, staleTime: 30_000 });
}

/** First zod issue, otherwise a friendly API error. */
export function errMsg(e: unknown) {
  if (e && typeof e === 'object' && 'issues' in e) {
    const i = (e as { issues: { message: string; path: (string | number)[] }[] }).issues[0];
    if (!i) return 'Check the form and try again.';
    return /^(Invalid|Too |Expected|Number|String)/.test(i.message) && i.path.length ? `${String(i.path[0]).replace(/_/g, ' ')}: ${i.message}` : i.message;
  }
  return friendlyError(e);
}

export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtDateTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <Text variant="caption" color="danger" accessibilityRole="alert" style={{ marginTop: 6, marginBottom: 6 }}>{typeof error === 'string' ? error : errMsg(error)}</Text>;
}

export function NoAccess({ what, title }: { what: string; title: string }) {
  return <Screen header={<Header title={title} />}><EmptyState icon="lock-closed-outline" title="Owner access needed" body={`${what} is managed by the business owner. Ask them to give you access, or sign in with the owner account.`} /></Screen>;
}

export function PermGate({ businessId, perm, title, what, children }: { businessId: string | undefined; perm: string; title: string; what: string; children: React.ReactNode }) {
  const { can, loading } = usePerms(businessId);
  if (loading) return <Screen header={<Header title={title} />}><Loading /></Screen>;
  if (!can(perm)) return <NoAccess title={title} what={what} />;
  return <>{children}</>;
}

/** Explains the two switches that gate paid orders: seller verification and the platform checkout switch. */
export function SellingNotice({ businessId }: { businessId: string }) {
  const { colors } = useTheme();
  const d = useSellerOverview(businessId).data;
  if (!d) return null;
  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      {!d.business.selling_enabled && (
        <Card style={{ backgroundColor: colors.warning + '14', borderColor: colors.warning + '66' }}>
          <Text variant="caption">Listing on Adey is free. You can take paid orders after your seller verification is approved.</Text>
          <Pressable onPress={() => router.push(`/dashboard/${businessId}/kyc`)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}><Text variant="label" color="primary">Open seller verification</Text></Pressable>
        </Card>
      )}
      {!d.checkout_enabled && <Card><Text variant="caption" color="muted">Online ordering is not open yet on Adey. You can prepare now: add delivery prices, payout details and products. Orders start once it opens.</Text></Card>}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 44, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {hint && <Text variant="caption" color="muted">{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} accessibilityLabel={label} />
    </View>
  );
}

export function ChipRow<T extends string>({ label, options, value, onChange }: { label?: string; options: { value: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text variant="label" style={{ marginBottom: 8 }}>{label}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map((o) => <Chip key={o.value} small label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />)}</View>
    </View>
  );
}

/** Parses an optional whole number from a text field: '' -> null, junk -> NaN. */
export const toInt = (s: string) => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Math.trunc(Number(s)) : NaN);

/** Country picker: a field that opens a searchable list. Value is the two-letter code. */
export function CountryField({ label, value, onChange, allowEmpty }: { label: string; value: string | null | undefined; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const { colors, radius } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const list = countriesForPicker.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || c.code.toLowerCase() === q.trim().toLowerCase());
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="label" style={{ marginBottom: 6 }}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? countryName(value) : 'not chosen'}`} style={{ minHeight: 50, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text color={value ? 'text' : 'muted'}>{value ? countryName(value) : 'Choose a country'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 48, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="subheading">{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          </View>
          <Input value={q} onChangeText={setQ} placeholder="Search countries" icon="search-outline" autoCorrect={false} />
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={allowEmpty && !q ? <Pressable onPress={() => { onChange(''); setOpen(false); }} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button"><Text color="muted">None</Text></Pressable> : undefined}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item.code); setOpen(false); setQ(''); }} accessibilityRole="button" accessibilityState={{ selected: item.code === value }} style={{ minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1 }}>{item.name}</Text>
                {item.code === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

export const centsToText = (c: number | null | undefined) => (c == null ? '' : (c / 100).toString());
