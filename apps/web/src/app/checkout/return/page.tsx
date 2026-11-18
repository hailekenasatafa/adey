import type { Metadata } from 'next';
import { CheckoutReturn } from './view';

export const metadata: Metadata = { title: 'Payment', robots: { index: false } };

export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ checkout_id?: string; status?: string; app?: string }> }) {
  const sp = await searchParams;
  return <CheckoutReturn id={sp.checkout_id ?? ''} status={sp.status === 'cancelled' ? 'cancelled' : 'success'} app={sp.app === '1'} />;
}
