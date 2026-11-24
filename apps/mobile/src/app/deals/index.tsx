import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useLocation } from '@/lib/location';
import { Button, EmptyState, ErrorState, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { DealCard } from '@/components/deals';
import { placeLabel } from '@/components/cards';

/** Deals from Habesha-owned businesses, nearest first when location is on. */
export default function Deals() {
  const { location } = useLocation();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const q = useQuery({ queryKey: ['deals-feed', query, location.lat, location.lng], queryFn: () => api.deals.feed({ query, lat: location.lat, lng: location.lng, limit: 40 }) });
  return (
    <Screen scroll={false} padded={false} header={<Header title="Deals" right={<Button title="My deals" size="sm" variant="ghost" onPress={() => router.push('/deals/mine')} />} />}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Text color="muted">Claim a deal on Adey, then show your code at the business. Claiming is free.</Text>
            <Input placeholder="Search deals or businesses" value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={() => setQuery(text.trim())} icon="search-outline" />
          </View>
        }
        ListEmptyComponent={q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <EmptyState icon="pricetags-outline" title={query ? 'No deals match' : 'No deals yet'} body={query ? 'Try another search.' : 'Businesses post deals here as they join Adey. Own a business? Post the first one from your dashboard — it’s free.'} />
        )}
        renderItem={({ item: d }) => (
          <DealCard showBusiness deal={{ id: d.id, title: d.title, description: d.description, terms: d.terms, image_path: d.image_path, claims_count: d.claims_count, my_claim: d.my_claim,
            business: { id: d.business_id, slug: d.business_slug, name: d.business_name, place: placeLabel(d) || null, cover_url: d.cover_url } }} />
        )}
      />
    </Screen>
  );
}
