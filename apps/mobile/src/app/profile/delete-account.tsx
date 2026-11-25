import React, { useState } from 'react';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, Card, Header, Input, Screen, Text } from '@/components/ui';

export default function DeleteAccount() {
  const { profile, signOut, businesses } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: () => api.profile.requestDeletion(),
    onSuccess: async () => { await signOut(); router.replace('/(tabs)'); },
    onError: (e) => setError(friendlyError(e)),
  });
  const already = !!profile?.deletion_requested_at;

  return (
    <Screen header={<Header title="Delete account" />}>
      <Card>
        <Text variant="subheading" color="danger">This is permanent</Text>
        <Text style={{ marginTop: 8 }}>Requesting deletion signs you out and schedules removal of your profile, saved items, messages, and notifications. Adey Connect staff process requests within 30 days, as required to complete active bookings and keep financial records auditable.</Text>
        {businesses.length > 0 && (
          <Text color="warning" style={{ marginTop: 10 }}>You own {businesses.length} business{businesses.length > 1 ? 'es' : ''}. Transfer ownership or unpublish them first, or they will be unpublished when the account is removed.</Text>
        )}
      </Card>
      {already ? (
        <Text color="muted" style={{ marginTop: 16 }}>A deletion request is already on file ({new Date(profile!.deletion_requested_at!).toLocaleDateString()}). Contact support to cancel it.</Text>
      ) : (
        <>
          <Input label='Type "DELETE" to confirm' value={confirm} onChangeText={setConfirm} autoCapitalize="characters" containerStyle={{ marginTop: 20 }} />
          {error && <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>{error}</Text>}
          <Button title="Request account deletion" variant="danger" fullWidth disabled={confirm !== 'DELETE'} loading={request.isPending} onPress={() => request.mutate()} />
        </>
      )}
    </Screen>
  );
}
