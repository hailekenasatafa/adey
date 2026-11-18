import React from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, ErrorState, Header, Loading, Screen } from '@/components/ui';
import { EventForm } from '@/components/community/EventForm';

export default function NewEvent() {
  const { user, loading, businesses } = useAuth();
  const can = useQuery({ queryKey: ['events', 'can-submit', user?.id], queryFn: () => api.events.canSubmit(), enabled: !!user });
  if (loading || (user && can.isLoading)) return <Screen header={<Header title="Submit an event" />}><Loading /></Screen>;
  if (!user) return <Screen header={<Header title="Submit an event" />}><EmptyState icon="calendar-outline" title="Sign in to submit an event" body="Verified businesses can share festivals, markets, concerts and gatherings with the Adey community." action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  if (can.isError) return <Screen header={<Header title="Submit an event" />}><ErrorState error={can.error} onRetry={() => can.refetch()} /></Screen>;
  if (!can.data?.allowed) return (
    <Screen header={<Header title="Submit an event" />}>
      <EmptyState icon="shield-checkmark-outline" title="Only verified businesses can post events" body="To post events, verify your business from the business dashboard. You can still browse events, say you are going, and add them to your calendar." action={businesses[0] ? 'Open business dashboard' : 'Go to my profile'} onAction={() => router.push(businesses[0] ? `/dashboard/${businesses[0].id}` : '/(tabs)/profile')} />
    </Screen>
  );
  return <EventForm />;
}
