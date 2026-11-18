import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currencies, currencyInfo, friendlyError, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Card, Divider, EmptyState, Header, Screen, Text } from '@/components/ui';
import { CountryPicker } from '@/components/community/CountryPicker';
import { FxAttribution } from '@/components/commerce';

export default function CurrencySettings() {
  const { colors } = useTheme();
  const { user, profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (patch: { preferred_currency?: Currency; country?: string }) => api.profile.update(patch),
    onSuccess: async () => { setErr(null); await refresh(); qc.invalidateQueries({ queryKey: ['cart'] }); qc.invalidateQueries({ queryKey: ['profile'] }); },
    onError: (e) => setErr(friendlyError(e)),
  });
  if (!user) return <Screen header={<Header title="Currency & country" />}><EmptyState icon="cash-outline" title="Sign in to choose a currency" /></Screen>;
  const cur = (profile?.preferred_currency ?? 'USD') as Currency;
  return (
    <Screen header={<Header title="Currency & country" />}>
      <Text variant="subheading" style={{ marginBottom: 6 }}>Currency</Text>
      <Text color="muted" style={{ marginBottom: 12 }}>You are always charged a price the seller set. Other currencies are shown as estimates.</Text>
      <Card padded={false} accessibilityRole="radiogroup">
        {currencies.map((c, i) => (
          <React.Fragment key={c}>
            {i > 0 && <Divider />}
            <Pressable onPress={() => save.mutate({ preferred_currency: c })} disabled={save.isPending} accessibilityRole="radio" accessibilityState={{ selected: cur === c }} accessibilityLabel={`${currencyInfo[c].name} (${c})`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 44 }}><Text variant="bodyStrong">{c}</Text></View>
              <Text style={{ flex: 1 }}>{currencyInfo[c].name}</Text>
              <Text color="muted" variant="caption" style={{ marginRight: 8 }}>{currencyInfo[c].symbol}</Text>
              {cur === c && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          </React.Fragment>
        ))}
      </Card>
      <View style={{ marginTop: 8 }}><FxAttribution /></View>

      <Text variant="subheading" style={{ marginTop: 24, marginBottom: 6 }}>Country</Text>
      <Text color="muted" style={{ marginBottom: 12 }}>Used to show what ships to you and to suggest your delivery address.</Text>
      <CountryPicker value={profile?.country} onChange={(code) => save.mutate({ country: code })} />
      {!!err && <Text color="danger" variant="caption" accessibilityLiveRegion="polite">{err}</Text>}
    </Screen>
  );
}
