import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { timeAgo } from '@/lib/format';
import { Avatar, Badge, EmptyState, ErrorState, Header, Screen, Skeleton, Text } from '@/components/ui';

export default function MessagesList() {
  const { colors } = useTheme();
  const { user, businesses } = useAuth();
  const q = useQuery({ queryKey: ['conversations', user?.id], queryFn: () => api.messaging.conversations(), enabled: !!user, refetchInterval: 30_000 });

  if (!user) {
    return <Screen header={<Header title="Messages" />}><EmptyState icon="chatbubbles-outline" title="Sign in to see your messages" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  }
  const myBizIds = new Set(businesses.map((b) => b.id));

  return (
    <Screen padded={false} scroll={false} header={<Header title="Messages" />}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item: c }) => {
          const me = c.participants.find((p) => p.user_id === user.id);
          const unread = !!c.last_message_at && (!me?.last_read_at || new Date(c.last_message_at) > new Date(me.last_read_at));
          const asBusiness = c.business_id && myBizIds.has(c.business_id);
          const other = c.participants.find((p) => p.user_id !== user.id);
          const title = asBusiness ? other?.profile?.display_name ?? 'Customer' : c.business?.name ?? other?.profile?.display_name ?? 'Conversation';
          const avatarUrl = asBusiness ? other?.profile?.avatar_url : c.business?.logo_url ? api.storage.publicUrl('business-media', c.business.logo_url) : other?.profile?.avatar_url;
          return (
            <Pressable onPress={() => router.push(`/messages/${c.id}`)} accessibilityRole="button" style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
              <Avatar url={avatarUrl} name={title} size={48} />
              <View style={{ flex: 1 }}>
                <View style={styles.top}>
                  <Text variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={{ flex: 1 }}>{title}</Text>
                  {c.last_message_at && <Text variant="caption" color="muted">{timeAgo(c.last_message_at)}</Text>}
                </View>
                <View style={styles.top}>
                  <Text variant="caption" color={unread ? 'text' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>{c.last_message_preview ?? 'No messages yet'}</Text>
                  {unread && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {asBusiness && <Badge label={`Inbox: ${c.business?.name}`} tone="primary" />}
                  {c.context_type !== 'general' && <Badge label={c.context_type.replace('_', ' ')} tone="neutral" />}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={q.isLoading ? <View style={{ padding: 16, gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={72} radius={14} />)}</View> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <EmptyState icon="chatbubbles-outline" title="No conversations yet" body="Contact a business or request a quote to start one." action="Explore businesses" onAction={() => router.push('/(tabs)/explore')} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
