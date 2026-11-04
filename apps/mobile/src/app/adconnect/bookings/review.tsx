import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, Card, Header, Input, Loading, Screen, Text } from '@/components/ui';

/** Post-booking review: advertiser rates the screen owner, owner rates the advertiser. */
export default function BookingReview() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { colors } = useTheme();
  const { user, businesses } = useAuth();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['booking', bookingId], queryFn: () => api.adconnect.booking(bookingId!) });
  const b = q.data;
  const iAmOwner = !!b && businesses.some((x) => x.id === b.screen_business_id);
  const submit = useMutation({
    mutationFn: () => api.market.addReview({ target_type: iAmOwner ? 'advertiser' : 'screen_owner', business_id: iAmOwner ? b!.advertiser_business_id : b!.screen_business_id, booking_id: b!.id, author_id: user!.id, rating, body: body || null }),
    onSuccess: () => router.back(),
    onError: (e) => setError(friendlyError(e)),
  });
  if (q.isLoading || !b) return <Screen header={<Header title="Review" />}><Loading /></Screen>;
  return (
    <Screen header={<Header title={iAmOwner ? 'Review the advertiser' : 'Review the screen owner'} subtitle={iAmOwner ? b.advertiser?.name : b.screenOwner?.name} />} keyboard>
      <Card>
        <Text variant="label">Your rating</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
          {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="radio" accessibilityLabel={`${n} stars`}><Ionicons name={n <= rating ? 'star' : 'star-outline'} size={34} color={colors.accent} /></Pressable>)}
        </View>
        <Input placeholder={iAmOwner ? 'Was the creative delivered on time? Clear communication?' : 'Did the ad play as agreed? How was communication?'} multiline value={body} onChangeText={setBody} />
        {error && <Text color="danger" variant="caption" style={{ marginBottom: 8 }}>{error}</Text>}
        <Button title="Post review" disabled={rating === 0} loading={submit.isPending} onPress={() => submit.mutate()} />
        <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Reviews are tied to this completed booking and marked as verified.</Text>
      </Card>
    </Screen>
  );
}
