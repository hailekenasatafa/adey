import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgeLabels, friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { Badge, Button, Card, Chip, EmptyState, Header, Input, Loading, Screen, Text } from '@/components/ui';

/**
 * Limited administration: the website remains the primary admin console.
 * Every action here runs through the same RLS/trigger rules as the website.
 */
export default function Admin() {
  const { roles, user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'verifications' | 'reports' | 'disputes'>('verifications');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const verifications = useQuery({ queryKey: ['admin-verifications'], queryFn: () => api.admin.pendingVerifications(), enabled: roles.staff });
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.admin.reports(), enabled: roles.staff });
  const disputes = useQuery({ queryKey: ['admin-disputes'], queryFn: () => api.admin.disputes(), enabled: roles.staff });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: Enums<'verification_status'> }) => api.admin.setVerificationStatus(id, status, notes[id] || undefined), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-verifications'] }), onError: (e) => setError(friendlyError(e)) });
  const resolveReport = useMutation({ mutationFn: ({ id, status }: { id: string; status: Enums<'report_status'> }) => api.admin.resolveReport(id, status, notes[id] || undefined), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }), onError: (e) => setError(friendlyError(e)) });
  const resolveDispute = useMutation({ mutationFn: ({ id, status }: { id: string; status: Enums<'dispute_status'> }) => api.admin.resolveDispute(id, status, notes[id] || 'Reviewed by Adey'), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-disputes'] }), onError: (e) => setError(friendlyError(e)) });

  if (!roles.staff) return <Screen header={<Header title="Administration" />}><EmptyState icon="lock-closed-outline" title="Staff only" body="Your account doesn't have moderation permissions." /></Screen>;

  return (
    <Screen header={<Header title="Administration" subtitle="Full console on the website" />} refreshing={verifications.isRefetching} onRefresh={() => { verifications.refetch(); reports.refetch(); disputes.refetch(); }}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Chip label={`Verifications (${verifications.data?.length ?? 0})`} selected={tab === 'verifications'} onPress={() => setTab('verifications')} />
        <Chip label={`Reports (${reports.data?.length ?? 0})`} selected={tab === 'reports'} onPress={() => setTab('reports')} />
        <Chip label={`Disputes (${disputes.data?.length ?? 0})`} selected={tab === 'disputes'} onPress={() => setTab('disputes')} />
      </View>
      {error && <Text color="danger" variant="caption" style={{ marginBottom: 8 }}>{error}</Text>}

      {tab === 'verifications' && (verifications.isLoading ? <Loading /> : !verifications.data?.length ? <EmptyState icon="shield-checkmark-outline" title="Queue is empty" /> : (
        <View style={{ gap: 10 }}>
          {verifications.data.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{r.business?.name}</Text>
                  <Text variant="caption" color="muted">{badgeLabels[r.level]} · {[r.business?.city, r.business?.state].filter(Boolean).join(', ')} · {fmtDate(r.created_at)}</Text>
                </View>
                <Badge label={r.status.replace('_', ' ')} tone={r.status === 'needs_info' ? 'warning' : 'info'} />
              </View>
              {r.applicant_notes && <Text variant="caption" style={{ marginTop: 6 }}>Applicant: {r.applicant_notes}</Text>}
              <Text variant="caption" color="muted" style={{ marginTop: 6 }}>{r.documents?.length ?? 0} document{(r.documents?.length ?? 0) === 1 ? '' : 's'} (open on the website to view securely)</Text>
              <Button title="View business" size="sm" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/business/${r.business?.slug}`)} />
              <Input placeholder="Note to applicant (required for needs-info / reject)" value={notes[r.id] ?? ''} onChangeText={(t) => setNotes({ ...notes, [r.id]: t })} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {r.status === 'submitted' && <Button title="Start review" size="sm" variant="secondary" onPress={() => setStatus.mutate({ id: r.id, status: 'in_review' })} />}
                <Button title="Approve" size="sm" onPress={() => Alert.alert('Approve verification?', `${r.business?.name} gets the "${badgeLabels[r.level]}" badge.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Approve', onPress: () => setStatus.mutate({ id: r.id, status: 'approved' }) }])} />
                <Button title="Needs info" size="sm" variant="outline" disabled={!notes[r.id]} onPress={() => setStatus.mutate({ id: r.id, status: 'needs_info' })} />
                <Button title="Reject" size="sm" variant="danger" disabled={!notes[r.id]} onPress={() => setStatus.mutate({ id: r.id, status: 'rejected' })} />
              </View>
            </Card>
          ))}
        </View>
      ))}

      {tab === 'reports' && (reports.isLoading ? <Loading /> : !reports.data?.length ? <EmptyState icon="flag-outline" title="No open reports" /> : (
        <View style={{ gap: 10 }}>
          {reports.data.map((r) => (
            <Card key={r.id}>
              <Badge label={r.target_type} tone="neutral" />
              <Text style={{ marginTop: 6 }}>{r.reason}</Text>
              <Text variant="caption" color="muted">{fmtDate(r.created_at)} · target {r.target_id.slice(0, 8)}…</Text>
              {r.target_type === 'business' && <Button title="Open listing" size="sm" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/business/${r.target_id}`)} />}
              <Input placeholder="Resolution note" value={notes[r.id] ?? ''} onChangeText={(t) => setNotes({ ...notes, [r.id]: t })} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button title="Dismiss" size="sm" variant="outline" onPress={() => resolveReport.mutate({ id: r.id, status: 'dismissed' })} />
                <Button title="Actioned" size="sm" onPress={() => resolveReport.mutate({ id: r.id, status: 'actioned' })} />
                {r.target_type === 'business' && <Button title="Suspend listing" size="sm" variant="danger" onPress={() => Alert.alert('Suspend business?', 'It disappears from the marketplace until reinstated.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Suspend', style: 'destructive', onPress: () => api.admin.setBusinessStatus(r.target_id, 'suspended').then(() => resolveReport.mutate({ id: r.id, status: 'actioned' })).catch((e) => setError(friendlyError(e))) }])} />}
              </View>
            </Card>
          ))}
        </View>
      ))}

      {tab === 'disputes' && (disputes.isLoading ? <Loading /> : !disputes.data?.length ? <EmptyState icon="alert-circle-outline" title="No open disputes" /> : (
        <View style={{ gap: 10 }}>
          {disputes.data.map((d) => (
            <Card key={d.id}>
              <Badge label={d.status.replace('_', ' ')} tone="danger" />
              <Text style={{ marginTop: 6 }}>{d.reason}</Text>
              <Text variant="caption" color="muted">Opened {fmtDate(d.created_at)}</Text>
              <Button title="Open booking" size="sm" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/adconnect/bookings/${d.booking_id}`)} />
              <Input placeholder="Resolution (shared with both parties)" value={notes[d.id] ?? ''} onChangeText={(t) => setNotes({ ...notes, [d.id]: t })} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {d.status === 'open' && <Button title="Under review" size="sm" variant="secondary" onPress={() => resolveDispute.mutate({ id: d.id, status: 'under_review' })} />}
                <Button title="Resolve" size="sm" disabled={!notes[d.id]} onPress={() => resolveDispute.mutate({ id: d.id, status: 'resolved' })} />
                <Button title="Dismiss" size="sm" variant="outline" disabled={!notes[d.id]} onPress={() => resolveDispute.mutate({ id: d.id, status: 'dismissed' })} />
              </View>
            </Card>
          ))}
        </View>
      ))}
      <Text variant="caption" color="muted" style={{ marginTop: 16 }}>Signed in as {user?.email}. Actions are audited.</Text>
    </Screen>
  );
}
