import * as WebBrowser from 'expo-web-browser';
import type { CheckoutSummary } from '@adey/shared';
import { api } from './supabase';
import { queryClient } from './query';

export const PAYMENT_RETURN_URL = 'adey://checkout/return';

/** Ask the server (and through it the payment provider) where a checkout stands. */
export async function checkoutState(checkoutId: string): Promise<{ status: string; summary: CheckoutSummary | null }> {
  try {
    const r = await api.checkout.status(checkoutId);
    return { status: r.summary?.status ?? r.status, summary: r.summary };
  } catch {
    const s = await api.checkout.summary(checkoutId);
    return { status: s?.status ?? 'unknown', summary: s };
  }
}

export function refreshCommerce() {
  queryClient.invalidateQueries({ queryKey: ['cart'] });
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['order'] });
  queryClient.invalidateQueries({ queryKey: ['pending-checkouts'] });
}

/**
 * Opens the hosted payment page in an auth session and, however it ends (redirect back or dismissed),
 * re-checks the checkout. Returns 'unavailable' when no payment page could be opened.
 */
export async function payCheckout(checkoutId: string): Promise<{ status: string; summary: CheckoutSummary | null } | 'unavailable'> {
  let url: string | null = null;
  try {
    const r = await api.checkout.pay(checkoutId, 'app');
    if (r.status === 'paid') return checkoutState(checkoutId);
    url = r.url;
  } catch {
    url = null;
  }
  if (!url) return 'unavailable';
  await WebBrowser.openAuthSessionAsync(url, PAYMENT_RETURN_URL).catch(() => null);
  const state = await checkoutState(checkoutId);
  refreshCommerce();
  return state;
}
