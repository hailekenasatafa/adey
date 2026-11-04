import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { formatDualPrice } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { cover } from '@/components/cards';
import { Badge, Button, Card, EmptyState, Header, Loading, Screen, Text } from '@/components/ui';

export default function ProductsManager() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['products', businessId], queryFn: () => api.market.products(businessId!) });
  return (
    <Screen header={<Header title="Products" right={<Button title="Add" size="sm" icon="add" onPress={() => router.push(`/dashboard/${businessId}/products/new`)} />} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? <Loading /> : !q.data?.length ? (
        <EmptyState icon="bag-handle-outline" title="No products yet" body="Add dishes, goods, or anything you sell so customers can browse and ask about them." action="Add first product" onAction={() => router.push(`/dashboard/${businessId}/products/new`)} />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data.map((p) => {
            const img = cover('product-media', p.images[0]);
            return (
              <Card key={p.id} padded={false} onPress={() => router.push(`/dashboard/${businessId}/products/${p.id}`)} accessibilityLabel={`Edit ${p.name}`}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>{img ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" /> : <Ionicons name="bag-handle-outline" size={22} color={colors.textMuted} />}</View>
                  <View style={{ flex: 1, padding: 12 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{p.name}</Text>
                    <Text variant="label" color="primary">{formatDualPrice(p)}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {!p.is_active && <Badge label="Hidden" tone="neutral" />}
                      <Badge label={p.availability.replace('_', ' ')} tone={p.availability === 'in_stock' ? 'success' : 'warning'} />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ alignSelf: 'center', marginRight: 12 }} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ thumb: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' } });
