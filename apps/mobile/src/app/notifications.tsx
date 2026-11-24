import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationRoute, type Notification } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, EmptyState, ErrorState, Header, Screen, Skeleton, Text } from '@/components/ui';
import { timeAgo } from '@/lib/format';

const ICONS: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  inquiry_new: 'chatbubble-ellipses-outline', ad_request_new: 'tv-outline', offer_accepted: 'checkmark-circle-outline', offer_countered: 'swap-horizontal-outline', request_declined: 'close-circle-outline',
  booking_confirmed: 'calendar-outline', verification_update: 'shield-checkmark-outline', payment_update: 'card-outline', campaign_completed: 'flag-outline', dispute_opened: 'alert-circle-outline',
  message_new: 'mail-outline', moderation: 'eye-outline', system: 'information-circle-outline',
  order_new: 'bag-handle-outline', order_update: 'receipt-outline', shipment_update: 'cube-outline', escrow_released: 'lock-open-outline', payout_update: 'wallet-outline',
  refund_update: 'return-down-back-outline', order_dispute: 'warning-outline', kyc_update: 'id-card-outline', certification_update: 'ribbon-outline', review_new: 'star-outline',
  low_stock: 'trending-down-outline', event_reminder: 'alarm-outline', event_update: 'calendar-outline', rewards_update: 'gift-outline', support_reply: 'help-buoy-outline',
  announcement: 'megaphone-outline',
  deal_new: 'pricetag-outline',
};

export default function Notifications() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['notifications', user?.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.notifications.list({ limit: 30, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length === 30 ? all.length * 30 : undefined),
    enabled: !!user,
  });
  const markAll = useMutation({ mutationFn: () => api.notifications.markRead(), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); } });
  const markOne = useMutation({ mutationFn: (id: string) => api.notifications.markRead([id]), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); } });

  useEffect(() => {
    if (!user) return;
    const ch = api.notifications.subscribe(user.id, () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); });
    return () => { ch.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once per user id
  }, [user?.id, qc]);

  const items = q.data?.pages.flat() ?? [];
  const open = (n: Notification) => {
    if (!n.read_at) markOne.mutate(n.id);
    // Routes come from the server (orders, cart, rewards, events, support, dashboard, admin); only in-app paths are
    // followed, and older notification types are translated to this app's screens.
    const route = notificationRoute(n.data, 'app');
    if (route) router.push(route as never);
  };

  return (
    <Screen padded={false} scroll={false} header={<Header title="Notifications" right={items.some((n) => !n.read_at) ? <Button title="Read all" size="sm" variant="ghost" onPress={() => markAll.mutate()} /> : undefined} />}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} accessibilityRole="button" style={({ pressed }) => [styles.row, { backgroundColor: item.read_at ? 'transparent' : colors.primarySoft + '66', opacity: pressed ? 0.7 : 1, borderBottomColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={ICONS[item.type] ?? 'notifications-outline'} size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text variant={item.read_at ? 'body' : 'bodyStrong'}>{item.title}</Text>
              {item.body && <Text variant="caption" color="muted" numberOfLines={2}>{item.body}</Text>}
              <Text variant="caption" color="muted" style={{ marginTop: 2 }}>{timeAgo(item.created_at)}</Text>
            </View>
            {!item.read_at && <View style={[styles.unread, { backgroundColor: colors.accent }]} />}
          </Pressable>
        )}
        ListEmptyComponent={q.isLoading ? <View style={{ padding: 16, gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={64} radius={14} />)}</View> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <EmptyState icon="notifications-off-outline" title="You're all caught up" body="Orders, messages, events, rewards, support replies and other updates will show up here." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  unread: { width: 8, height: 8, borderRadius: 4 },
});
