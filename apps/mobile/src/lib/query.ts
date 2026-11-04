import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Query client with sensible caching for an unstable-network marketplace.
 * Public listings are cached (and persisted lightly) so the app is usable
 * offline; sensitive data (messages, bookings, dashboards) is never persisted.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => {
        const msg = (err as Error)?.message ?? '';
        if (/permission|JWT|row-level/i.test(msg)) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

const PERSIST_PREFIX = 'adey.cache.';
const PUBLIC_KEYS = ['home', 'categories', 'settings', 'search-businesses', 'business', 'search-screens', 'screen', 'search-products'];

/** Persist only public, non-sensitive queries for offline fallback. */
export async function persistPublicCache() {
  const entries = queryClient
    .getQueryCache()
    .getAll()
    .filter((q) => PUBLIC_KEYS.includes(String(q.queryKey[0])) && q.state.status === 'success')
    .slice(0, 40)
    .map((q) => [PERSIST_PREFIX + JSON.stringify(q.queryKey), JSON.stringify({ t: Date.now(), d: q.state.data })] as [string, string]);
  if (entries.length) await AsyncStorage.multiSet(entries).catch(() => {});
}

export async function hydratePublicCache() {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith(PERSIST_PREFIX));
  if (!keys.length) return;
  const pairs = await AsyncStorage.multiGet(keys).catch(() => []);
  for (const [k, v] of pairs) {
    if (!v) continue;
    try {
      const parsed = JSON.parse(v) as { t: number; d: unknown };
      if (Date.now() - parsed.t > 7 * 86400_000) {
        AsyncStorage.removeItem(k).catch(() => {});
        continue;
      }
      const key = JSON.parse(k.slice(PERSIST_PREFIX.length));
      if (!queryClient.getQueryData(key)) queryClient.setQueryData(key, parsed.d, { updatedAt: parsed.t });
    } catch {
      // ignore corrupt cache entries
    }
  }
}
