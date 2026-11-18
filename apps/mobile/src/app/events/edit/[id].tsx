import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { EmptyState, ErrorState, Header, Loading, Screen } from '@/components/ui';
import { EventForm } from '@/components/community/EventForm';

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api.events.get(id) });
  if (q.isLoading) return <Screen header={<Header title="Edit event" />}><Loading /></Screen>;
  if (q.isError) return <Screen header={<Header title="Edit event" />}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  if (!q.data) return <Screen header={<Header title="Edit event" />}><EmptyState icon="calendar-outline" title="Event not found" /></Screen>;
  return <EventForm existing={q.data} />;
}
