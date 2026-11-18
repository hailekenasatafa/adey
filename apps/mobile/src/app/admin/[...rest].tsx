import React from 'react';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WEB_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, EmptyState, Header, Screen } from '@/components/ui';

/** Marketplace queues (/admin/kyc, /admin/certifications, /admin/order-disputes, …) live in the web admin console. */
export default function AdminQueue() {
  const { rest } = useLocalSearchParams<{ rest?: string | string[] }>();
  const { roles } = useAuth();
  const parts = Array.isArray(rest) ? rest : rest ? [rest] : [];
  const path = `/admin/${parts.map(encodeURIComponent).join('/')}`;
  return (
    <Screen header={<Header title="Administration" />}>
      {roles.staff ? (
        <EmptyState icon="desktop-outline" title="Handled in the web admin console" body="This queue is reviewed on the Adey website, where staff have the full tools and audit log." action="Open in browser" onAction={() => Linking.openURL(`${WEB_URL}${path}`)} />
      ) : (
        <EmptyState icon="lock-closed-outline" title="Staff only" body="Your account doesn't have moderation permissions." />
      )}
      <Button title="Mobile admin" variant="ghost" onPress={() => router.replace('/admin')} />
    </Screen>
  );
}
