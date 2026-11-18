import { useQuery } from '@tanstack/react-query';
import type { CommerceSettings, Currency } from '@adey/shared';
import { api } from './supabase';
import { useAuth } from './auth';

/** Marketplace switches set by Adey admins. Checkout stays hidden until `checkout_enabled` is on. */
export function useCommerce() {
  const q = useQuery({ queryKey: ['settings', 'commerce'], queryFn: () => api.settings.get<CommerceSettings>('commerce'), staleTime: 5 * 60_000 });
  return { settings: q.data, checkoutEnabled: !!q.data?.checkout_enabled, loading: q.isLoading };
}

/** Exchange rates for "≈" estimates next to real prices. Never used to charge. */
export function useFxRates() {
  return useQuery({ queryKey: ['fx-rates'], queryFn: () => api.fx.rates(), staleTime: 60 * 60_000 });
}

/** The currency the member wants to pay in (profile setting; USD for guests). */
export function usePreferredCurrency(): Currency {
  const { profile } = useAuth();
  return (profile?.preferred_currency ?? 'USD') as Currency;
}

/** Cart contents for the signed-in member; `count` drives the tab badge. */
export function useCart() {
  const { user } = useAuth();
  const currency = usePreferredCurrency();
  return useQuery({ queryKey: ['cart', user?.id, currency], queryFn: () => api.cart.view(currency), enabled: !!user, staleTime: 15_000 });
}
