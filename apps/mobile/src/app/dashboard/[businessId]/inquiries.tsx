import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Header, Loading, Screen, Text } from '@/components/ui';

type Status = 'new' | 'read' | 'replied' | 'closed';

export default function Inquiries() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const q = useQuery({ queryKey: ['inquiries', businessId], queryFn: () => api.owner.inquiries(businessId!), refetchInterval: 30_000 });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: Status }) => api.owner.setInquiryStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['inquiries', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); } });
  const items = (q.data ?? []).filter((i) => filter === 'all' || i.status === 'new' || i.status === 'read');

  return (
    <Screen header={<Header title="Customer inquiries" />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Chip label="Open" selected={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
      </View>
      {q.isLoading ? <Loading /> : items.length === 0 ? (
        <EmptyState icon="chatbubble-ellipses-outline" title={filter === 'open' ? 'No open inquiries' : 'No inquiries yet'} body="When customers contact you or request a quote, it appears here and in Messages." />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((i) => (
            <Card key={i.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar url={i.from?.avatar_url} name={i.from?.display_name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{i.from?.display_name ?? 'Customer'}</Text>
                  <Text variant="caption" color="muted">{timeAgo(i.created_at)}</Text>
                </View>
                <Badge label={i.type === 'quote' ? 'Quote request' : i.type === 'advertising' ? 'Advertising' : 'Message'} tone={i.type === 'quote' ? 'accent' : 'neutral'} />
                <Badge label={i.status} tone={i.status === 'new' ? 'warning' : i.status === 'replied' ? 'success' : 'neutral'} />
              </View>
              {i.subject && <Text variant="label" style={{ marginTop: 10 }}>{i.subject}</Text>}
              <Text style={{ marginTop: 4 }} numberOfLines={4}>{i.message}</Text>
              {i.contact_phone && <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Callback: {i.contact_phone}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title="Reply in Messages" size="sm" icon="chatbubble-outline" onPress={() => { if (i.status === 'new') setStatus.mutate({ id: i.id, status: 'read' }); if (i.conversation_id) router.push(`/messages/${i.conversation_id}`); }} />
                {i.status !== 'replied' && <Button title="Mark replied" size="sm" variant="secondary" onPress={() => setStatus.mutate({ id: i.id, status: 'replied' })} />}
                {i.status !== 'closed' && <Button title="Close" size="sm" variant="ghost" onPress={() => setStatus.mutate({ id: i.id, status: 'closed' })} />}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
