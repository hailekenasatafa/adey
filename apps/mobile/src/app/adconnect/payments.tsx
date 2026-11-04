import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import { Badge, Card, EmptyState, Header, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { BusinessPicker, useSelectedBusiness } from '@/components/BusinessPicker';

type History = { monetization_enabled: boolean; payments: { id: string; amount_cents: number; currency: string; status: string; provider: string; created_at: string; receipt_url: string | null }[]; payouts: { id: string; amount_cents: number; currency: string; status: string; scheduled_for: string | null; paid_at: string | null; created_at: string }[] };

/** Payment-ready surface: reads real records only; nothing here moves money. */
export default function Payments() {
  const { businessId: initial } = useLocalSearchParams<{ businessId?: string }>();
  const [bizId, setBizId] = useSelectedBusiness(initial);
  const q = useQuery({ queryKey: ['payments', bizId], queryFn: () => api.adconnect.paymentHistory(bizId!) as Promise<History>, enabled: !!bizId });
  if (!bizId) return <Screen header={<Header title="Payments" />}><EmptyState icon="card-outline" title="No business selected" /></Screen>;
  const h = q.data;
  return (
    <Screen header={<Header title="Payments & payouts" />}>
      <BusinessPicker value={bizId} onChange={setBizId} />
      {q.isLoading || !h ? <Loading /> : (
        <>
          {!h.monetization_enabled && (
            <Card>
              <Badge label="Free Launch Mode" tone="accent" />
              <Text style={{ marginTop: 8 }}>Integrated payments, receipts, and payouts are switched off. Bookings are settled directly between advertiser and screen owner, and Adey charges no commission.</Text>
              <Text variant="caption" color="muted" style={{ marginTop: 6 }}>When Adey enables Monetized Mode, this page will show payment intents, receipts, and payout tracking without an app update.</Text>
            </Card>
          )}
          <SectionHeader title={`Payments (${h.payments.length})`} />
          {h.payments.length === 0 ? <Text color="muted">No payments recorded.</Text> : h.payments.map((p) => (
            <Card key={p.id} style={{ marginBottom: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="bodyStrong">{formatMoney(p.amount_cents, p.currency as 'USD')}</Text><Badge label={p.status} tone={p.status === 'paid' ? 'success' : 'warning'} /></View><Text variant="caption" color="muted">{fmtDate(p.created_at)} · {p.provider}</Text></Card>
          ))}
          <SectionHeader title={`Payouts (${h.payouts.length})`} />
          {h.payouts.length === 0 ? <Text color="muted">No payouts recorded.</Text> : h.payouts.map((p) => (
            <Card key={p.id} style={{ marginBottom: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="bodyStrong">{formatMoney(p.amount_cents, p.currency as 'USD')}</Text><Badge label={p.status} tone={p.status === 'paid' ? 'success' : 'warning'} /></View><Text variant="caption" color="muted">{p.paid_at ? `Paid ${fmtDate(p.paid_at)}` : p.scheduled_for ? `Scheduled ${fmtDate(p.scheduled_for)}` : fmtDate(p.created_at)}</Text></Card>
          ))}
        </>
      )}
    </Screen>
  );
}
