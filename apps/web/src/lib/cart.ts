'use client';
import { useSyncExternalStore } from 'react';
import type { ScreenCard } from '@adey/shared';

export type CartItem = Pick<ScreenCard, 'id' | 'business_id' | 'business_name' | 'city' | 'state' | 'title' | 'image' | 'base_price_cents' | 'base_duration_days' | 'currency' | 'badges' | 'rating_avg'>;
const KEY = 'adey.campaign-cart';
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };

function snapshot(): CartItem[] {
  if (typeof window === 'undefined') return EMPTY;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { raw = null; }
  if (raw !== cache.raw) {
    let items: CartItem[] = EMPTY;
    try { items = raw ? (JSON.parse(raw) as CartItem[]) : EMPTY; } catch { items = EMPTY; }
    cache = { raw, items };
  }
  return cache.items;
}
function write(items: CartItem[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage may be unavailable */ }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener('storage', l);
  return () => { listeners.delete(l); window.removeEventListener('storage', l); };
}

/** "Add to Campaign" selection, kept in the browser until the wizard submits it. */
export function useCart() {
  const items = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return {
    items,
    has: (id: string) => items.some((i) => i.id === id),
    toggle: (item: CartItem) => write(items.some((i) => i.id === item.id) ? items.filter((i) => i.id !== item.id) : [...items, item]),
    remove: (id: string) => write(items.filter((i) => i.id !== id)),
    clear: () => write([]),
    setMany: (next: CartItem[]) => write(next),
  };
}
