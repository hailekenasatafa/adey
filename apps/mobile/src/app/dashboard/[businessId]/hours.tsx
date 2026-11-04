import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyError, hoursSchema, type Hours } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { Button, Header, Loading, Screen, Text } from '@/components/ui';
import { HoursEditor } from '@/components/HoursEditor';

export default function HoursScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { business } = useManagedBusiness(businessId);
  if (business.isLoading || !business.data) return <Screen header={<Header title="Opening hours" />}><Loading /></Screen>;
  const parsed = hoursSchema.safeParse(business.data.hours);
  return <HoursForm key={business.data.id} businessId={businessId!} initial={parsed.success ? parsed.data : {}} />;
}

function HoursForm({ businessId, initial }: { businessId: string; initial: Hours }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState<Hours>(initial);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.owner.update(businessId, { hours }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); router.back(); },
    onError: (e) => setError(friendlyError(e)),
  });
  return (
    <Screen header={<Header title="Opening hours" />}>
      <Text color="muted" style={{ marginBottom: 12 }}>Customers see "Open now" based on these hours and their local time.</Text>
      <HoursEditor value={hours} onChange={setHours} />
      {error && <Text color="danger" variant="caption" style={{ marginTop: 12 }}>{error}</Text>}
      <Button title="Save hours" size="lg" fullWidth style={{ marginTop: 20 }} loading={save.isPending} onPress={() => save.mutate()} />
    </Screen>
  );
}
