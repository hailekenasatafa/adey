import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { Badge, Button, Card, Divider, EmptyState, ErrorState, Header, Loading, Screen, Text, VerificationBadges } from '@/components/ui';
import { MenuRow } from '@/components/MenuRow';
import { SellingPanel } from '@/components/seller/SellingPanel';
import { SellingNotice } from '@/components/seller/common';
import { useCommerce } from '@/lib/commerce';
import { useAdconnect } from '@/lib/settings';

type Overview = {
  business: { id: string; name: string; status: string; market: string; logo_url: string | null };
  badges: string[]; pending_verifications: number; profile_completeness: number; profile_views_30d: number; contact_clicks_30d: number;
  open_inquiries: number; pending_ad_requests: number; upcoming_bookings: number; active_campaigns: number;
  revenue: { completed_net_cents: number; expected_confirmed_cents: number; currency: 'USD' }; rating: { avg: number | null; count: number };
};

export default function BusinessDashboard() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const { membership, business, canManage } = useManagedBusiness(businessId);
  const overview = useQuery({ queryKey: ['overview', businessId], queryFn: () => api.owner.overview(businessId!) as Promise<Overview>, enabled: !!businessId && !!membership, refetchInterval: 60_000 });
  const [err, setErr] = useState<string | null>(null);
  const { checkoutEnabled } = useCommerce();
  const { campaignsEnabled } = useAdconnect();
  const deals = useQuery({ queryKey: ['owner-deals', businessId], queryFn: () => api.deals.owner(businessId!), enabled: !!businessId && !!membership });
  const claimed = (deals.data ?? []).reduce((n, d) => n + d.claims_count, 0);
  const activeDeals = (deals.data ?? []).filter((d) => d.status === 'active').length;

  const publish = useMutation({
    mutationFn: (status: 'published' | 'draft') => api.owner.update(businessId!, { status }),
    onSuccess: async () => { await refresh(); qc.invalidateQueries({ queryKey: ['business', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); },
    onError: (e) => setErr(friendlyError(e)),
  });

  if (!membership) return <Screen header={<Header title="Dashboard" />}><EmptyState icon="lock-closed-outline" title="Not your business" body="You don't manage this business." action="My businesses" onAction={() => router.replace('/(tabs)/profile')} /></Screen>;
  if (business.isLoading) return <Screen header={<Header title="Dashboard" />}><Loading /></Screen>;
  if (business.isError || !business.data) return <Screen header={<Header title="Dashboard" />}><ErrorState error={business.error} onRetry={() => business.refetch()} /></Screen>;
  const b = business.data;
  const o = overview.data;

  const togglePublish = () => {
    if (b.status === 'published') Alert.alert('Unpublish business?', 'Customers will no longer find it until you publish again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Unpublish', style: 'destructive', onPress: () => publish.mutate('draft') }]);
    else if ((o?.profile_completeness ?? 0) < 40) Alert.alert('Add a little more first', 'Add a category, phone, description, and location so customers can trust and reach you. Publish anyway?', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Publish', onPress: () => publish.mutate('published') }]);
    else publish.mutate('published');
  };

  return (
    <Screen header={<Header title={b.name} subtitle={membership.role === 'owner' ? 'Owner' : membership.role} right={<Pressable onPress={() => router.push(`/business/${b.slug}`)} hitSlop={8} accessibilityLabel="View public page"><Ionicons name="eye-outline" size={22} color={colors.primary} /></Pressable>} />} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {/* Status */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 6 }}>
            <Badge label={b.status === 'published' ? 'Published' : b.status === 'suspended' ? 'Suspended by Adey' : b.status === 'pending' ? 'Pending review' : 'Draft (not visible)'} tone={b.status === 'published' ? 'success' : b.status === 'suspended' ? 'danger' : 'warning'} />
            <VerificationBadges badges={o?.badges as never} compact />
          </View>
          {canManage && b.status !== 'suspended' && <Button title={b.status === 'published' ? 'Unpublish' : 'Publish'} size="sm" variant={b.status === 'published' ? 'outline' : 'primary'} loading={publish.isPending} onPress={togglePublish} />}
        </View>
        {b.status === 'suspended' && <Text variant="caption" color="danger" style={{ marginTop: 8 }}>Contact Adey support to resolve the suspension.</Text>}
        {err && <Text variant="caption" color="danger" style={{ marginTop: 8 }}>{err}</Text>}
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color="muted">Profile completeness</Text>
            <Text variant="caption">{o?.profile_completeness ?? 0}%</Text>
          </View>
          <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${o?.profile_completeness ?? 0}%`, backgroundColor: (o?.profile_completeness ?? 0) >= 70 ? colors.success : colors.accent }]} /></View>
        </View>
      </Card>

      {/* Stats */}
      <View style={styles.grid}>
        <Stat label="Profile views · 30d" value={o?.profile_views_30d} icon="eye-outline" />
        <Stat label="Contact clicks · 30d" value={o?.contact_clicks_30d} icon="call-outline" />
        <Stat label="Open inquiries" value={o?.open_inquiries} icon="chatbubble-ellipses-outline" onPress={() => router.push(`/dashboard/${b.id}/inquiries`)} highlight={!!o?.open_inquiries} />
        <Stat label="Deals claimed" value={claimed} icon="pricetags-outline" onPress={() => router.push(`/dashboard/${b.id}/deals`)} />
        {campaignsEnabled && <Stat label="Ad requests waiting" value={o?.pending_ad_requests} icon="tv-outline" onPress={() => router.push('/adconnect/requests')} highlight={!!o?.pending_ad_requests} />}
        {campaignsEnabled && <Stat label="Upcoming bookings" value={o?.upcoming_bookings} icon="calendar-outline" onPress={() => router.push('/adconnect/bookings')} />}
        <Stat label="Rating" value={o?.rating.avg != null ? `${Number(o.rating.avg).toFixed(1)} (${o.rating.count})` : '—'} icon="star-outline" />
      </View>

      {/* Selling: only while online orders are switched on */}
      {checkoutEnabled && <>
        <Text variant="overline" color="muted" style={{ marginTop: 24 }}>Selling</Text>
        <View style={{ marginTop: 8 }}><SellingNotice businessId={b.id} /></View>
        <SellingPanel businessId={b.id} role={membership.role} />
      </>}

      {/* Revenue — honest labels; only while AdConnect bookings are switched on */}
      {campaignsEnabled && <Card style={{ marginTop: 12 }}>
        <Text variant="overline" color="muted">Advertising revenue</Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="muted">Completed (net)</Text>
            <Text variant="heading">{formatMoney(o?.revenue.completed_net_cents ?? 0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="muted">Expected from confirmed bookings</Text>
            <Text variant="heading" color="muted">{formatMoney(o?.revenue.expected_confirmed_cents ?? 0)}</Text>
          </View>
        </View>
        <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Only completed bookings count as revenue. Expected amounts are not earnings yet.</Text>
      </Card>}

      {/* Manage */}
      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Manage business</Text>
      <Card padded={false}>
        <MenuRow icon="create-outline" label="Edit details, description & location" onPress={() => router.push(`/dashboard/${b.id}/edit`)} />
        <Divider />
        <MenuRow icon="images-outline" label="Logo, cover & photos" onPress={() => router.push(`/dashboard/${b.id}/photos`)} />
        <Divider />
        <MenuRow icon="time-outline" label="Opening hours" onPress={() => router.push(`/dashboard/${b.id}/hours`)} />
        <Divider />
        <MenuRow icon="restaurant-outline" label="Menu & services" onPress={() => router.push(`/dashboard/${b.id}/services`)} />
        <Divider />
        <MenuRow icon="pricetags-outline" label="Deals & redeem codes" value={activeDeals ? `${activeDeals} active` : undefined} onPress={() => router.push(`/dashboard/${b.id}/deals`)} />
        <Divider />
        <MenuRow icon="bag-handle-outline" label="Products" onPress={() => router.push(`/dashboard/${b.id}/products`)} />
        <Divider />
        <MenuRow icon="chatbubbles-outline" label="Customer inquiries" value={o?.open_inquiries ? `${o.open_inquiries} open` : undefined} onPress={() => router.push(`/dashboard/${b.id}/inquiries`)} />
        <Divider />
        <MenuRow icon="shield-checkmark-outline" label="Verification" value={o?.pending_verifications ? `${o.pending_verifications} in review` : (o?.badges?.length ?? 0) > 0 ? `${o?.badges.length} badge${(o?.badges.length ?? 0) > 1 ? 's' : ''}` : 'Not verified'} onPress={() => router.push(`/dashboard/${b.id}/verification`)} />
        <Divider />
        <MenuRow icon="stats-chart-outline" label="Analytics" onPress={() => router.push(`/dashboard/${b.id}/analytics`)} />
        <Divider />
        <MenuRow icon="people-outline" label="Team members" onPress={() => router.push(`/dashboard/${b.id}/team`)} />
      </Card>

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>AdConnect</Text>
      <Card padded={false}>
        <MenuRow icon="albums-outline" label="My advertising screens" onPress={() => router.push({ pathname: '/adconnect/my-screens', params: { businessId: b.id } })} />
        {campaignsEnabled && <>
        <Divider />
        <MenuRow icon="mail-unread-outline" label="Incoming advertising requests" value={o?.pending_ad_requests ? `${o.pending_ad_requests} waiting` : undefined} onPress={() => router.push({ pathname: '/adconnect/requests', params: { businessId: b.id } })} />
        <Divider />
        <MenuRow icon="megaphone-outline" label="Campaigns (as advertiser)" value={o?.active_campaigns ? `${o.active_campaigns} active` : undefined} onPress={() => router.push({ pathname: '/adconnect/campaigns', params: { businessId: b.id } })} />
        <Divider />
        <MenuRow icon="wallet-outline" label="Earnings & calendar" onPress={() => router.push({ pathname: '/adconnect/earnings', params: { businessId: b.id } })} />
        </>}
      </Card>
    </Screen>
  );
}

function Stat({ label, value, icon, onPress, highlight }: { label: string; value: number | string | undefined; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; highlight?: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.stat, { backgroundColor: highlight ? colors.accentSoft : colors.surface, borderColor: colors.border, borderRadius: radius.lg }]} accessibilityRole={onPress ? 'button' : 'text'}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text variant="heading" style={{ marginTop: 6 }}>{value ?? '—'}</Text>
      <Text variant="caption" color="muted">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { height: 6, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: { width: '48%', flexGrow: 1, padding: 14, borderWidth: 1 },
});
