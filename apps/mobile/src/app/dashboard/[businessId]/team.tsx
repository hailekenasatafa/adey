import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { Avatar, Badge, Card, Header, Loading, Screen, Text } from '@/components/ui';

export default function Team() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { isOwner } = useManagedBusiness(businessId);
  const q = useQuery({ queryKey: ['members', businessId], queryFn: () => api.owner.members(businessId!) });
  return (
    <Screen header={<Header title="Team members" />}>
      <Text color="muted" style={{ marginBottom: 12 }}>Owners control everything; managers can edit the profile, inventory, and respond to requests; staff can view the dashboard and reply to messages.</Text>
      {q.isLoading ? <Loading /> : (
        <View style={{ gap: 10 }}>
          {(q.data ?? []).map((m) => (
            <Card key={m.user_id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar url={m.profile?.avatar_url} name={m.profile?.display_name} size={40} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>{m.profile?.display_name ?? 'Member'}</Text>
                <Badge label={m.role} tone={m.role === 'owner' ? 'primary' : 'neutral'} />
              </View>
            </Card>
          ))}
        </View>
      )}
      {isOwner && <Text variant="caption" color="muted" style={{ marginTop: 16 }}>Inviting team members by email is handled on the Adey website (Business → Team), which can look up accounts securely.</Text>}
    </Screen>
  );
}
