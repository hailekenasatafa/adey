import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { cover } from '@/components/cards';
import { Badge, Button, Card, EmptyState, Header, Loading, Screen, Text } from '@/components/ui';
import { BusinessPicker, useSelectedBusiness } from '@/components/BusinessPicker';

export default function MyScreens() {
  const { businessId: initial } = useLocalSearchParams<{ businessId?: string }>();
  const { colors } = useTheme();
  const { businesses } = useAuth();
  const qc = useQueryClient();
  const [bizId, setBizId] = useSelectedBusiness(initial);
  const biz = businesses.find((b) => b.id === bizId);
  const q = useQuery({ queryKey: ['my-screens', bizId], queryFn: () => api.adconnect.myScreens(bizId!), enabled: !!bizId });
  const toggle = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' }) => api.adconnect.updateScreen(id, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-screens', bizId] }) });

  if (!bizId) return <Screen header={<Header title="My screens" />}><EmptyState icon="tv-outline" title="Create a business first" body="Screens belong to a published business profile." action="Create business" onAction={() => router.push('/business/new')} /></Screen>;

  return (
    <Screen header={<Header title="My screens" subtitle={biz?.name} right={<Button title="Add" size="sm" icon="add" onPress={() => router.push({ pathname: '/adconnect/my-screens/[screenId]', params: { screenId: 'new', businessId: bizId } })} />} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <BusinessPicker value={bizId} onChange={setBizId} />
      {biz?.status !== 'published' && (
        <Card style={{ marginBottom: 12, borderColor: colors.warning }}>
          <Text variant="label" color="warning">Business not published</Text>
          <Text variant="caption" color="muted">Advertisers only see screens of published businesses. Publish from your dashboard.</Text>
          <Button title="Open dashboard" size="sm" variant="secondary" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => router.push(`/dashboard/${bizId}`)} />
        </Card>
      )}
      {q.isLoading ? <Loading /> : !q.data?.length ? (
        <EmptyState icon="tv-outline" title="No screens listed" body="Add the TVs in your space: size, where they are, hours they play, and your price. Advertisers nearby will find them." action="Add my first screen" onAction={() => router.push({ pathname: '/adconnect/my-screens/[screenId]', params: { screenId: 'new', businessId: bizId } })} />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data.map((s) => {
            const img = cover('screen-media', s.images[0]);
            const priv = Array.isArray(s.private) ? s.private[0] : s.private;
            return (
              <Card key={s.id} padded={false} onPress={() => router.push({ pathname: '/adconnect/my-screens/[screenId]', params: { screenId: s.id, businessId: bizId } })} accessibilityLabel={`Edit ${s.title}`}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]}>{img ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" /> : <Ionicons name="tv-outline" size={26} color={colors.accent} />}</View>
                  <View style={{ flex: 1, padding: 12, gap: 4 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{s.title}</Text>
                    <Text variant="caption" color="muted">{s.screen_count} screen{s.screen_count === 1 ? '' : 's'}{s.screen_size_inches ? ` · ${s.screen_size_inches}"` : ''} · {formatMoney(s.base_price_cents, s.currency)} / {s.base_duration_days}d{priv?.min_price_cents != null ? ` · floor ${formatMoney(priv.min_price_cents, s.currency)}` : ''}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Badge label={s.status} tone={s.status === 'active' ? 'success' : s.status === 'paused' ? 'warning' : 'neutral'} />
                      <Badge label={`${s.packages?.length ?? 0} package${(s.packages?.length ?? 0) === 1 ? '' : 's'}`} tone="neutral" />
                    </View>
                  </View>
                  <View style={{ justifyContent: 'center', paddingRight: 10 }}>
                    {s.status !== 'archived' && <Button title={s.status === 'active' ? 'Pause' : 'Activate'} size="sm" variant={s.status === 'active' ? 'outline' : 'primary'} onPress={() => toggle.mutate({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' })} />}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Button title="Incoming requests" variant="secondary" icon="mail-unread-outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/adconnect/requests', params: { businessId: bizId } })} />
        <Button title="Calendar & earnings" variant="secondary" icon="calendar-outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/adconnect/earnings', params: { businessId: bizId } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ thumb: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' } });
