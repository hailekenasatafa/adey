import React from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { EmptyState, Header, Loading, Screen } from '@/components/ui';
import { EventForm } from '@/components/community/EventForm';

export default function NewEvent() {
  const { user, loading } = useAuth();
  if (loading) return <Screen header={<Header title="Add an event" />}><Loading /></Screen>;
  if (!user) return <Screen header={<Header title="Add an event" />}><EmptyState icon="calendar-outline" title="Sign in to add an event" body="Share a festival, market, concert or community gathering with the Adey community." action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  return <EventForm />;
}
