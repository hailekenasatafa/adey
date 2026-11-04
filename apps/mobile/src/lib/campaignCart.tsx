import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScreenCard } from '@adey/shared';

/**
 * "Add to Campaign" selection kept on-device until the advertiser submits the
 * campaign wizard. Nothing here is a request — requests only exist once the
 * backend RPC confirms them.
 */
export type CartItem = Pick<ScreenCard, 'id' | 'business_id' | 'business_name' | 'city' | 'state' | 'title' | 'image' | 'base_price_cents' | 'base_duration_days' | 'currency' | 'badges' | 'rating_avg'> & { package_id?: string | null };

type Ctx = { items: CartItem[]; has: (id: string) => boolean; toggle: (item: CartItem) => void; remove: (id: string) => void; clear: () => void; setMany: (items: CartItem[]) => void };
const CartContext = createContext<Ctx | null>(null);
const KEY = 'adey.campaign-cart';

export function CampaignCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setItems(JSON.parse(v)));
  }, []);
  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => ({
    items,
    has: (id) => items.some((i) => i.id === id),
    toggle: (item) => persist(items.some((i) => i.id === item.id) ? items.filter((i) => i.id !== item.id) : [...items, item]),
    remove: (id) => persist(items.filter((i) => i.id !== id)),
    clear: () => persist([]),
    setMany: (next) => persist(next),
  }), [items, persist]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCampaignCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCampaignCart must be used within CampaignCartProvider');
  return ctx;
}
