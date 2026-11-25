import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, manualPayoutSchema, payoutStatusLabels } from '@adey/shared';
import { api } from '@/lib/supabase';
import { Badge, Button, Card, Divider, EmptyState, ErrorState, Header, Input, Loading, Screen, Skeleton, Text } from '@/components/ui';
import { ChipRow, ErrorNote, NoAccess, errMsg, fmtDate, usePerms } from '@/components/seller/common';

const METHODS = [['bank_transfer', 'Bank transfer'], ['telebirr', 'Telebirr'], ['cbe_birr', 'CBE Birr'], ['mobile_money', 'Mobile money'], ['other', 'Other']] as const;

export default function PayoutsScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { can, loading } = usePerms(businessId);
  if (loading) return <Screen header={<Header title="Payouts" />}><Loading /></Screen>;
  const manage = can('payouts.manage');
  if (!manage && !can('finance.view')) return <NoAccess title="Payouts" what="Payouts" />;
  return <Payouts businessId={businessId!} manage={manage} />;
}

function Payouts({ businessId, manage }: { businessId: string; manage: boolean }) {
  const qc = useQueryClient();
  const acct = useQuery({ queryKey: ['payout-account', businessId], queryFn: () => api.seller.payoutAccount(businessId) });
  const list = useQuery({ queryKey: ['payouts', businessId], queryFn: () => api.seller.payouts(businessId) });
  const ledger = useQuery({ queryKey: ['ledger', businessId], queryFn: () => api.seller.ledger(businessId) });
  const [err, setErr] = useState<string | null>(null);
  const [connectErr, setConnectErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<{ method: string; details: string }>({ method: 'bank_transfer', details: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const inv = () => { for (const k of ['payout-account', 'payouts', 'seller-overview']) qc.invalidateQueries({ queryKey: [k, businessId] }); };
  const a = acct.data;
  const connected = a?.provider === 'stripe' && !!a.stripe_account_id;
  const go = async (action: 'onboard' | 'dashboard') => {
    setBusy(true); setErr(null);
    try {
      const r = await api.seller.connectPayouts(businessId, action);
      if (!r.url) throw new Error('No link returned');
      await WebBrowser.openBrowserAsync(r.url);
      await api.seller.connectPayouts(businessId, 'refresh').catch(() => null);
      inv();
    } catch (e) { if (action === 'onboard') { setConnectErr(true); setErr('Connected payouts could not be started. You can add payout details manually below.'); } else setErr(friendlyError(e)); } finally { setBusy(false); }
  };
  const saveManual = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { const p = manualPayoutSchema.parse(m); await api.seller.setManualPayout(businessId, p.method, p.details); setM({ ...m, details: '' }); setMsg('Payout details saved. Held payouts will be scheduled.'); inv(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Screen header={<Header title="Payouts" />} keyboard refreshing={list.isRefetching} onRefresh={() => { acct.refetch(); list.refetch(); ledger.refetch(); }}>
      <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Adey Connect holds each buyer's payment and releases it to you after delivery is confirmed.</Text>
      <View style={{ gap: 14 }}>
        {manage && (
          <Card>
            <Text variant="subheading" style={{ marginBottom: 8 }}>How you get paid</Text>
            {acct.isLoading ? <Skeleton height={60} /> : acct.error ? <ErrorState error={acct.error} onRetry={() => acct.refetch()} /> : (
              <>
                {connected ? (
                  <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Badge tone={a!.details_submitted ? 'success' : 'warning'} label={a!.details_submitted ? 'Details submitted' : 'Details needed'} />
                      <Badge tone={a!.payouts_enabled ? 'success' : 'warning'} label={a!.payouts_enabled ? 'Payouts on' : 'Payouts not on yet'} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {!a!.details_submitted && <Button title="Continue setup" size="sm" disabled={busy} onPress={() => go('onboard')} />}
                      <Button title="Open payout dashboard" size="sm" variant="outline" disabled={busy} onPress={() => go('dashboard')} />
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text variant="caption" color="muted">Connected payouts send money straight to your bank account. They are available in many countries, not all (for example not Ethiopia).</Text>
                    {!connectErr && <Button title="Set up connected payouts" size="sm" style={{ marginTop: 10, alignSelf: 'flex-start' }} disabled={busy} onPress={() => go('onboard')} />}
                  </View>
                )}
                {(!connected || connectErr) && (
                  <View style={{ marginTop: 14 }}>
                    <Divider style={{ marginBottom: 12 }} />
                    <Text variant="label" style={{ marginBottom: 8 }}>Or add payout details manually</Text>
                    {a?.manual_details_hint && <Text style={{ marginBottom: 8 }}>Saved: <Text variant="bodyStrong">{METHODS.find(([k]) => k === a.manual_method)?.[1] ?? a.manual_method}</Text> {a.manual_details_hint}. Enter new details to replace them.</Text>}
                    <ChipRow label="Method" value={m.method} onChange={(method) => setM((x) => ({ ...x, method }))} options={METHODS.map(([value, label]) => ({ value, label }))} />
                    <Input label="Account holder, bank or wallet, and number" hint="Stored encrypted. Only a short hint is shown afterwards." value={m.details} onChangeText={(details) => setM((x) => ({ ...x, details }))} multiline autoComplete="off" autoCorrect={false} />
                    <Button title="Save payout details" loading={busy} onPress={saveManual} />
                  </View>
                )}
              </>
            )}
            {msg && <Text variant="caption" color="success" accessibilityRole="alert" style={{ marginTop: 8 }}>{msg}</Text>}
            <ErrorNote error={err} />
          </Card>
        )}

        <Card>
          <Text variant="subheading">Payouts</Text>
          {list.isLoading ? <Skeleton height={60} style={{ marginTop: 8 }} /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.length ? (
            <EmptyState icon="cash-outline" title="No payouts yet" body="A payout is created for each order once the buyer confirms delivery." />
          ) : list.data.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{formatMoney(p.amount_cents, p.currency)}</Text>
                {p.order && <Text variant="label" color="primary" onPress={() => router.push(`/dashboard/${businessId}/orders/${p.order!.id}`)} accessibilityRole="link">Order #{p.order.order_number}</Text>}
                <Text variant="caption" color="muted">{p.paid_at ? `Paid ${fmtDate(p.paid_at)}` : p.scheduled_for ? `Scheduled ${fmtDate(p.scheduled_for)}` : fmtDate(p.created_at)}{p.failure_reason ? ` · ${p.failure_reason}` : ''}</Text>
              </View>
              <Badge tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'on_hold' ? 'warning' : 'info'} label={payoutStatusLabels[p.status]} />
            </View>
          ))}
        </Card>

        <Card>
          <Text variant="subheading">Money history</Text>
          {ledger.isLoading ? <Skeleton height={60} style={{ marginTop: 8 }} /> : ledger.error ? <ErrorState error={ledger.error} onRetry={() => ledger.refetch()} /> : !ledger.data?.length ? <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Nothing here yet.</Text> : ledger.data.map((l) => (
            <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ textTransform: 'capitalize' }}>{l.kind.replace(/_/g, ' ')}{l.note ? `: ${l.note}` : ''}</Text>
                <Text variant="caption" color="muted">{fmtDate(l.created_at)}</Text>
              </View>
              <Text variant="bodyStrong">{formatMoney(l.amount_cents, l.currency)}</Text>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
