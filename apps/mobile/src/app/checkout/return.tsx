import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { checkoutState, refreshCommerce } from '@/lib/payment';
import { Button, EmptyState, Header, Loading, Screen } from '@/components/ui';

/** Deep link adey://checkout/return?checkout_id=…&status=success|cancelled opened by the OS after payment. */
export default function CheckoutReturn() {
  const { checkout_id: id, status } = useLocalSearchParams<{ checkout_id?: string; status?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    (async () => {
      try {
        const s = await checkoutState(id);
        if (s.status === 'pending' && status === 'cancelled') await api.checkout.cancel(id).catch(() => null);
        refreshCommerce();
        if (!live) return;
        if (s.status === 'paid') router.replace({ pathname: '/orders', params: { paid: id } });
        else if (s.status === 'pending' && status !== 'cancelled') router.replace('/orders');
        else router.replace('/cart');
      } catch (e) {
        if (live) setError(friendlyError(e));
      }
    })();
    return () => { live = false; };
  }, [id, status]);

  return (
    <Screen header={<Header title="Payment" />}>
      {!id ? <EmptyState icon="alert-circle-outline" title="Missing checkout" body="Open your orders to see where your payment stands." action="My orders" onAction={() => router.replace('/orders')} />
        : error ? (
          <>
            <EmptyState icon="alert-circle-outline" title="Couldn't check your payment" body={error} />
            <Button title="My orders" onPress={() => router.replace('/orders')} />
          </>
        ) : <Loading label="Checking your payment…" />}
    </Screen>
  );
}
