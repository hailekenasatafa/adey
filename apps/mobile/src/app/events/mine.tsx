import React from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventCategoryLabels, friendlyError, type EventStatus } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Screen, Text } from '@/components/ui';
import { eventWhen } from '@/components/community/events';

const statusLabel: Record<EventStatus, string> = { draft: 'Draft', pending: 'In review', published: 'Published', rejected: 'Not approved', cancelled: 'Cancelled' };
const statusTone: Record<EventStatus, 'neutral' | 'warning' | 'success' | 'danger'> = { draft: 'neutral', pending: 'warning', published: 'success', rejected: 'danger', cancelled: 'neutral' };

export default function MyEvents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-events', user?.id], queryFn: () => api.events.mine(), enabled: !!user });
  const done = () => { qc.invalidateQueries({ queryKey: ['my-events'] }); qc.invalidateQueries({ queryKey: ['events'] }); };
  const cancel = useMutation({ mutationFn: (id: string) => api.events.setStatus(id, 'cancelled'), onSuccess: done, onError: (e) => Alert.alert('Could not cancel', friendlyError(e)) });
  const remove = useMutation({ mutationFn: (id: string) => api.events.remove(id), onSuccess: done, onError: (e) => Alert.alert('Could not delete', friendlyError(e)) });
  const header = <Header title="My events" right={<Button title="Add" size="sm" variant="ghost" onPress={() => router.push('/events/new')} />} />;

  if (!user) return <Screen header={header}><EmptyState icon="calendar-outline" title="Sign in to see your events" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  if (q.isLoading) return <Screen header={header}><Loading /></Screen>;
  if (q.isError) return <Screen header={header}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const items = q.data ?? [];
  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {items.length === 0 ? (
        <EmptyState icon="calendar-outline" title="You have not submitted any events" body="Share a festival, market, concert or community gathering." action="Add an event" onAction={() => router.push('/events/new')} />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((e) => (
            <Card key={e.id}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <Badge label={statusLabel[e.status]} tone={statusTone[e.status]} />
                <Badge label={eventCategoryLabels[e.category]} tone="neutral" />
              </View>
              <Text variant="bodyStrong">{e.title}</Text>
              <Text variant="caption" color="muted">{eventWhen(e)}</Text>
              {e.status === 'rejected' && !!e.rejection_reason && <Text variant="caption" color="danger" style={{ marginTop: 4 }}>Reason: {e.rejection_reason}</Text>}
              {e.status === 'pending' && <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Waiting for review. It will appear in the calendar once approved.</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {e.status === 'published' && <Button title="View" size="sm" variant="outline" onPress={() => router.push(`/events/${e.id}`)} />}
                {e.status !== 'cancelled' && <Button title="Edit" size="sm" variant="secondary" onPress={() => router.push(`/events/edit/${e.id}`)} />}
                {(e.status === 'published' || e.status === 'pending') && (
                  <Button title="Cancel event" size="sm" variant="outline" loading={cancel.isPending && cancel.variables === e.id} onPress={() => Alert.alert('Cancel this event?', 'People who RSVP’d will see it as cancelled.', [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel event', style: 'destructive', onPress: () => cancel.mutate(e.id) }])} />
                )}
                {e.status !== 'published' && (
                  <Button title="Delete" size="sm" variant="ghost" loading={remove.isPending && remove.variables === e.id} onPress={() => Alert.alert('Delete this event?', 'This cannot be undone.', [{ text: 'Keep', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(e.id) }])} />
                )}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
