import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, LEGAL_PAGES_PUBLISHED, type PrivacySettings } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Avatar, Button, Card, Divider, EmptyState, Header, Loading, Screen, Text } from '@/components/ui';
import { MenuRow } from '@/components/MenuRow';
import { ToggleRow } from '@/components/community/controls';

export default function Privacy() {
  const { user, profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const priv = ((profile?.privacy && typeof profile.privacy === 'object' && !Array.isArray(profile.privacy) ? profile.privacy : {}) as Partial<PrivacySettings>);
  const isPublic = priv.public_profile !== false;
  const personalised = priv.personalized_recommendations !== false;

  const setPriv = useMutation({
    mutationFn: (patch: Partial<PrivacySettings>) => api.account.setPrivacy(patch),
    onSuccess: async () => { setErr(null); await refresh(); qc.invalidateQueries({ queryKey: ['profile'] }); },
    onError: (e) => setErr(friendlyError(e)),
  });
  const blocked = useQuery({ queryKey: ['blocked', user?.id], queryFn: () => api.account.blockedUsers(), enabled: !!user });
  const unblock = useMutation({ mutationFn: (id: string) => api.messaging.unblock(id, user!.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked'] }), onError: (e) => Alert.alert('Could not unblock', friendlyError(e)) });

  const download = async () => {
    setExporting(true);
    setErr(null);
    try {
      const data = await api.account.exportData();
      const file = new File(Paths.cache, `adey-my-data-${new Date().toISOString().slice(0, 10)}.json`);
      file.create({ overwrite: true });
      await file.write(JSON.stringify(data, null, 2));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'My Adey Connect data' });
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setExporting(false);
    }
  };

  if (!user) return <Screen header={<Header title="Privacy" />}><EmptyState icon="eye-off-outline" title="Sign in to manage privacy" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  return (
    <Screen header={<Header title="Privacy" />}>
      <Card>
        <ToggleRow label="Private profile" hint="Other members see “Adey Connect member” instead of your name and photo. Sellers still receive the delivery name on your orders." value={!isPublic} onChange={(v) => setPriv.mutate({ public_profile: !v })} disabled={setPriv.isPending} />
        <Divider />
        <ToggleRow label="Personalised recommendations" hint="Use what you view and save to suggest products and businesses." value={personalised} onChange={(v) => setPriv.mutate({ personalized_recommendations: v })} disabled={setPriv.isPending} />
      </Card>
      {!!err && <Text color="danger" variant="caption" style={{ marginTop: 8 }} accessibilityLiveRegion="polite">{err}</Text>}

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Blocked members</Text>
      {blocked.isLoading ? <Loading /> : blocked.isError ? (
        <Card><Text color="danger">{friendlyError(blocked.error)}</Text><Button title="Try again" variant="ghost" size="sm" onPress={() => blocked.refetch()} /></Card>
      ) : (blocked.data ?? []).length === 0 ? (
        <Card><Text color="muted">You have not blocked anyone.</Text></Card>
      ) : (
        <Card padded={false}>
          {(blocked.data ?? []).map((b, i) => (
            <View key={b.blocked_id}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                <Avatar url={b.blocked?.avatar_url} name={b.blocked?.display_name} size={40} />
                <Text style={{ flex: 1 }} numberOfLines={1}>{b.blocked?.display_name ?? 'Adey Connect member'}</Text>
                <Button title="Unblock" size="sm" variant="outline" loading={unblock.isPending && unblock.variables === b.blocked_id} onPress={() => unblock.mutate(b.blocked_id)} accessibilityLabel={`Unblock ${b.blocked?.display_name ?? 'member'}`} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Your data</Text>
      <Card>
        <Text color="muted">Get a copy of everything Adey Connect holds about you as a JSON file.</Text>
        <Button title="Download my data" icon="download-outline" variant="secondary" style={{ marginTop: 10 }} loading={exporting} onPress={download} />
      </Card>
      <Card padded={false} style={{ marginTop: 12 }}>
        {LEGAL_PAGES_PUBLISHED && (<><MenuRow icon="document-outline" label="Privacy policy & terms" onPress={() => router.push('/profile/legal')} /><Divider /></>)}
        <MenuRow icon="trash-outline" label="Delete my account" danger onPress={() => router.push('/profile/delete-account')} />
      </Card>
    </Screen>
  );
}
