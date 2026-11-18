import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Input, Loading, RatingStars, Screen, Text } from '@/components/ui';
import { ErrorNote, fmtDate } from '@/components/seller/common';

export default function Reviews() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['seller-reviews', businessId], queryFn: () => api.seller.reviews(businessId!) });
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const send = useMutation({
    mutationFn: () => api.market.respondToReview(reply!.id, reply!.text.trim()),
    onSuccess: () => { setReply(null); qc.invalidateQueries({ queryKey: ['seller-reviews', businessId] }); },
  });
  return (
    <Screen header={<Header title="Reviews" />} keyboard refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Your reply is public. Keep it polite and factual.</Text>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? <EmptyState icon="star-outline" title="No reviews yet" body="Reviews from buyers appear here." /> : (
        <View style={{ gap: 10 }}>
          {q.data.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <RatingStars rating={r.rating} count={1} />
                <Text variant="bodyStrong">{r.author?.display_name ?? 'Member'}</Text>
                {r.is_verified_purchase && <Badge tone="success" label="Verified purchase" />}
                {r.status !== 'published' && <Badge tone="warning" label={r.status} />}
              </View>
              <Text variant="caption" color="muted">{fmtDate(r.created_at)}</Text>
              {(r.authenticity_rating != null || r.service_rating != null) && (
                <Text variant="caption" color="muted" style={{ marginTop: 4 }}>{r.authenticity_rating != null ? `Authenticity ${r.authenticity_rating}/5` : ''}{r.authenticity_rating != null && r.service_rating != null ? ' · ' : ''}{r.service_rating != null ? `Service ${r.service_rating}/5` : ''}</Text>
              )}
              {r.product && <Text variant="caption" style={{ marginTop: 4 }}>On <Text variant="label" color="primary" onPress={() => router.push(`/dashboard/${businessId}/products/${r.product!.id}`)} accessibilityRole="link">{r.product.name}</Text></Text>}
              {r.title && <Text variant="bodyStrong" style={{ marginTop: 8 }}>{r.title}</Text>}
              {r.body && <Text style={{ marginTop: 4 }}>{r.body}</Text>}
              {r.response ? (
                <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: 'rgba(128,128,128,0.12)' }}>
                  <Text variant="caption"><Text variant="label">Your reply</Text>{r.response_at ? ` · ${fmtDate(r.response_at)}` : ''}{'\n'}{r.response}</Text>
                </View>
              ) : reply?.id === r.id ? (
                <View style={{ marginTop: 10 }}>
                  <Input label="Your reply" value={reply.text} onChangeText={(text) => setReply({ id: r.id, text })} multiline maxLength={1000} />
                  <ErrorNote error={send.error} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setReply(null)} />
                    <Button title="Post reply" style={{ flex: 1 }} disabled={reply.text.trim().length < 2} loading={send.isPending} onPress={() => send.mutate()} />
                  </View>
                </View>
              ) : <Button title="Reply" variant="outline" size="sm" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => { send.reset(); setReply({ id: r.id, text: '' }); }} />}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
