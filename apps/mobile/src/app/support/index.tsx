import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Screen, Text } from '@/components/ui';
import { MenuRow } from '@/components/MenuRow';

const STARTERS = ['Where is my order?', 'How do refunds work?', 'How do I become a verified seller?', 'How do Adey Connect Rewards work?'];

export default function Support() {
  const { user } = useAuth();
  const { order } = useLocalSearchParams<{ order?: string }>();
  const q = useQuery({ queryKey: ['support-threads', user?.id], queryFn: () => api.support.threads(), enabled: !!user });
  const header = <Header title="Help & support" />;
  const start = (starter?: string) => router.push({ pathname: '/support/[id]', params: { id: 'new', ...(order ? { order } : {}), ...(starter ? { q: starter } : {}) } });

  if (!user) return (
    <Screen header={header}>
      <EmptyState icon="help-buoy-outline" title="Sign in to chat with us" body="The help center is open to everyone. Chat with the assistant needs an account." action="Sign in" onAction={() => router.push('/(auth)/sign-in')} />
      <Card padded={false}><MenuRow icon="book-outline" label="Browse the help center" onPress={() => router.push('/help')} /></Card>
    </Screen>
  );
  const threads = q.data ?? [];
  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Card>
        <Text variant="subheading">Ask the Adey Connect Assistant</Text>
        <Text color="muted" style={{ marginTop: 4 }}>Quick answers about orders, delivery, payments and more. It is automated, and you can ask for a person at any time.</Text>
        <View style={{ gap: 8, marginTop: 12 }}>
          {STARTERS.map((s) => <Button key={s} title={s} variant="outline" onPress={() => start(s)} />)}
          <Button title="New conversation" icon="add" onPress={() => start()} />
        </View>
      </Card>
      <Card padded={false} style={{ marginTop: 12 }}><MenuRow icon="book-outline" label="Browse the help center" onPress={() => router.push('/help')} /></Card>

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Your conversations</Text>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : threads.length === 0 ? (
        <Card><Text color="muted">No conversations yet.</Text></Card>
      ) : (
        <View style={{ gap: 8 }}>
          {threads.map((t) => (
            <Card key={t.id} onPress={() => router.push(`/support/${t.id}`)} accessibilityLabel={`Conversation: ${t.subject ?? t.last_message_preview ?? 'Support'}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{t.subject || t.last_message_preview || 'Conversation'}</Text>
                <Badge label={t.status === 'waiting_staff' ? 'With support team' : t.status === 'resolved' ? 'Resolved' : 'Open'} tone={t.status === 'waiting_staff' ? 'warning' : t.status === 'resolved' ? 'neutral' : 'info'} />
              </View>
              {!!t.last_message_preview && <Text variant="caption" color="muted" numberOfLines={2} style={{ marginTop: 4 }}>{t.last_message_preview}</Text>}
              {!!t.last_message_at && <Text variant="caption" color="muted" style={{ marginTop: 2 }}>{timeAgo(t.last_message_at)}</Text>}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
