import type { Metadata } from 'next';
import { currencies, type Currency } from '@adey/shared';
import { CheckoutFlow } from './flow';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ currency?: string }> }) {
  const { currency } = await searchParams;
  const c = currencies.includes(currency as Currency) ? (currency as Currency) : undefined;
  return <CheckoutFlow currency={c} />;
}
