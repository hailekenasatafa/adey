'use client';
import { useEffect, useState } from 'react';
import type { ScreenCard } from '@adey/shared';

export type CartItem = Pick<ScreenCard, 'id' | 'business_id' | 'business_name' | 'city' | 'state' | 'title' | 'image' | 'base_price_cents' | 'base_duration_days' | 'currency' | 'badges' | 'rating_avg'>;
const KEY = 'adey.campaign-cart';
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function write(items: CartItem[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage may be unavailable */ }
  listeners.forEach((l) => l());
}

/** "Add to Campaign" selection, kept in the browser until the wizard submits it. */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => { setItems(read()); const l = () => setItems(read()); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return {
    items,
    has: (id: string) => items.some((i) => i.id === id),
    toggle: (item: CartItem) => write(items.some((i) => i.id === item.id) ? items.filter((i) => i.id !== item.id) : [...items, item]),
    remove: (id: string) => write(items.filter((i) => i.id !== id)),
    clear: () => write([]),
    setMany: (next: CartItem[]) => write(next),
  };
}
