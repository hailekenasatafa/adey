import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Avatar, Badge, Button, Card, Input, Text } from '@/components/ui';
import { ReportButton } from '@/components/ReportButton';

export function ReviewList({ businessId, canReview }: { businessId: string; canReview: boolean }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const reviews = useQuery({ queryKey: ['reviews', businessId], queryFn: () => api.market.reviews(businessId) });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const submit = useMutation({
    mutationFn: () => api.market.addReview({ business_id: businessId, author_id: user!.id, rating, body: body.trim() || null }),
    onSuccess: () => {
      setWriting(false); setRating(0); setBody('');
      qc.invalidateQueries({ queryKey: ['reviews', businessId] });
      qc.invalidateQueries({ queryKey: ['business'] });
    },
    onError: (e) => setError(friendlyError(e)),
  });
  const mine = reviews.data?.some((r) => r.author_id === user?.id);

  return (
    <View style={{ marginTop: 16, gap: 12 }}>
      {canReview && !mine && !writing && <Button title="Write a review" variant="secondary" icon="create-outline" onPress={() => setWriting(true)} />}
      {!canReview && <Button title="Sign in to write a review" variant="secondary" onPress={() => router.push('/(auth)/sign-in')} />}
      {writing && (
        <Card>
          <Text variant="label">Your rating</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="radio" accessibilityState={{ selected: rating === n }} accessibilityLabel={`${n} stars`}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={colors.accent} />
              </Pressable>
            ))}
          </View>
          <Input placeholder="Share what stood out (optional)" multiline value={body} onChangeText={setBody} maxLength={4000} />
          {error && <Text color="danger" variant="caption" style={{ marginBottom: 8 }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="ghost" size="sm" onPress={() => setWriting(false)} />
            <Button title="Post review" size="sm" disabled={rating === 0} loading={submit.isPending} onPress={() => submit.mutate()} />
          </View>
        </Card>
      )}
      {reviews.isLoading ? (
        <Text color="muted">Loading reviews…</Text>
      ) : reviews.data?.length ? (
        reviews.data.map((r) => (
          <Card key={r.id}>
            <View style={styles.head}>
              <Avatar url={r.author?.avatar_url} name={r.author?.display_name} size={36} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text variant="label">{r.author?.display_name ?? 'Adey member'}</Text>
                <Text variant="caption" color="muted">{new Date(r.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                {[1, 2, 3, 4, 5].map((n) => <Ionicons key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={14} color={colors.accent} />)}
              </View>
            </View>
            {r.is_verified_customer && <View style={{ marginTop: 6 }}><Badge label="Contacted this business" tone="info" icon="checkmark-circle-outline" /></View>}
            {r.title && <Text variant="bodyStrong" style={{ marginTop: 8 }}>{r.title}</Text>}
            {r.body && <Text style={{ marginTop: 4 }}>{r.body}</Text>}
            {r.response && (
              <View style={[styles.response, { backgroundColor: colors.surfaceMuted }]}>
                <Text variant="caption" color="muted">Response from the business</Text>
                <Text variant="caption" style={{ marginTop: 2 }}>{r.response}</Text>
              </View>
            )}
            {r.author_id !== user?.id && <View style={{ marginTop: 8, alignItems: 'flex-end' }}><ReportButton targetType="review" targetId={r.id} /></View>}
          </Card>
        ))
      ) : (
        <Text color="muted">No reviews yet. Be the first to share your experience.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center' }, response: { marginTop: 10, padding: 10, borderRadius: 10 } });
