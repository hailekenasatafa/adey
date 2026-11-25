'use client';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, LayoutGrid, Search, ShoppingBag, Store, type LucideIcon } from 'lucide-react';
import type { SearchSuggestion } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { mediaUrlFromPath } from '@/lib/media';

/**
 * The one search box on the site (Airbnb-style). It sits in the header and searches the section you are in:
 * businesses on Home and Market, deals on Deals, events on Events, screens on AdConnect, everything on /search.
 * List pages read `q` (and `city` where they support it) from the address, so a search keeps their other filters.
 */
type Scope = { action: string; what: string; where: boolean; label: string };
function scopeFor(path: string, view: string | null): Scope {
  if (path.startsWith('/deals')) return { action: '/deals', label: 'Search deals', what: 'Deal or business', where: true };
  if (path.startsWith('/events')) return { action: '/events', label: 'Search events', what: 'Event, venue or host', where: true };
  if (path.startsWith('/adconnect')) return { action: '/adconnect', label: 'Search screens', what: 'Business, screen or city', where: false };
  if (path.startsWith('/search')) return { action: '/search', label: 'Search Adey Connect', what: 'Businesses, products, events', where: false };
  if (path.startsWith('/market') && view === 'products') return { action: '/market', label: 'Search products', what: 'Product or shop', where: false };
  return { action: '/market', label: 'Search businesses', what: 'Business, food or service', where: true };
}

const kindIcon: Record<SearchSuggestion['type'], LucideIcon> = { product: ShoppingBag, business: Store, category: LayoutGrid, event: CalendarDays };
const hrefFor = (s: SearchSuggestion) =>
  s.type === 'product' ? `/product/${s.id}` : s.type === 'business' ? `/business/${s.slug ?? s.id}` : s.type === 'event' ? `/events/${s.id}` : `/market?category=${s.id}`;

export type SiteSearchHandle = { focus: () => void };

export const SiteSearch = forwardRef<SiteSearchHandle, { size?: 'lg' | 'sm' }>(function SiteSearch({ size = 'lg' }, ref) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const scope = scopeFor(path, sp.get('view'));
  const onPage = path === scope.action;
  const [q, setQ] = useState(onPage ? sp.get('q') ?? '' : '');
  const [city, setCity] = useState(onPage ? sp.get('city') ?? '' : '');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLFormElement>(null);
  const listId = useId();
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  // Follow the address when it changes (back/forward, filter links, another section).
  const key = `${path}?${sp.toString()}`;
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) { setLastKey(key); setQ(onPage ? sp.get('q') ?? '' : ''); setCity(onPage ? sp.get('city') ?? '' : ''); setOpen(false); }

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 220); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const s = useQuery({ queryKey: ['suggest', debounced], queryFn: () => api.shop.suggestions(debounced, 6), enabled: debounced.length >= 2, staleTime: 60_000 });
  const items = open && q.trim().length >= 2 ? s.data ?? [] : [];
  const showAll = open && q.trim().length >= 2 && scope.action !== '/search';
  const count = items.length + (showAll ? 1 : 0);

  const submit = () => {
    const params = new URLSearchParams(onPage ? sp.toString() : '');
    const set = (k: string, v: string) => (v.trim() ? params.set(k, v.trim()) : params.delete(k));
    set('q', q);
    if (scope.where) set('city', city);
    params.delete('page');
    setOpen(false);
    input.current?.blur();
    router.push(params.size ? `${scope.action}?${params}` : scope.action);
  };
  const pick = (i: number) => {
    setOpen(false);
    if (i < items.length) router.push(hrefFor(items[i]));
    else router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const big = size === 'lg';
  return (
    <form ref={box} role="search" aria-label={scope.label} onSubmit={(e) => { e.preventDefault(); if (active >= 0 && active < count) pick(active); else submit(); }}
      className={`relative mx-auto flex w-full items-center rounded-full border border-border bg-surface transition focus-within:shadow-lg ${big ? 'max-w-3xl shadow-md md:h-16' : 'max-w-md shadow-sm'} h-12`}>
      <label className={`group flex h-full min-w-0 flex-1 cursor-text items-center gap-3 rounded-full transition ${big ? 'px-5 md:flex-col md:items-start md:justify-center md:gap-0 md:px-7 md:hover:bg-surface-muted md:focus-within:bg-surface md:focus-within:shadow-md' : 'px-4'}`}>
        <Search aria-hidden className={`h-4 w-4 text-text-muted ${big ? 'md:hidden' : ''}`} />
        <span className={`text-xs font-semibold ${big ? 'hidden md:block' : 'sr-only'}`}>{scope.where ? 'What' : 'Search'}</span>
        <input ref={input} name="q" value={q} autoComplete="off" spellCheck={false} placeholder={scope.what} aria-label={scope.label}
          role="combobox" aria-expanded={items.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, count - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-text-muted md:text-sm" />
      </label>
      {scope.where && big && (
        <>
          <span aria-hidden className="hidden h-8 w-px bg-border md:block" />
          <label className="group hidden h-full w-56 cursor-text flex-col items-start justify-center rounded-full px-7 transition hover:bg-surface-muted focus-within:bg-surface focus-within:shadow-md md:flex">
            <span className="text-xs font-semibold">Where</span>
            <input name="city" value={city} autoComplete="address-level2" placeholder="Any city" aria-label="City"
              onChange={(e) => setCity(e.target.value)} onFocus={() => setOpen(false)}
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-text-muted" />
          </label>
        </>
      )}
      <button type="submit" aria-label={scope.label}
        className={`mr-1.5 grid shrink-0 place-items-center rounded-full bg-forest text-[color:var(--on-forest)] transition hover:brightness-110 active:scale-95 ${big ? 'h-9 w-9 md:mr-2 md:h-12 md:w-12' : 'h-9 w-9'}`}>
        <Search aria-hidden className={big ? 'h-4 w-4 md:h-5 md:w-5' : 'h-4 w-4'} strokeWidth={2.25} />
      </button>

      {count > 0 && (
        <ul id={listId} role="listbox" aria-label="Suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-auto rounded-[24px] border border-border bg-surface-raised p-2 shadow-lg md:right-auto md:w-[min(100%,34rem)]">
          {items.map((x, i) => {
            const img = x.image ? mediaUrlFromPath(x.type === 'product' ? 'product-media' : 'business-media', x.image) : null;
            const Icon = kindIcon[x.type];
            return (
              <li key={`${x.type}-${x.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}
                  className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left ${i === active ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-surface-muted text-text-muted">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <Icon aria-hidden className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{x.label}</span>
                    {x.sublabel && <span className="block truncate text-xs text-text-muted">{x.sublabel}</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {showAll && (
            <li id={`${listId}-${items.length}`} role="option" aria-selected={active === items.length}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(items.length)}
                className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-sm ${active === items.length ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-surface-muted text-text-muted"><Search aria-hidden className="h-5 w-5" /></span>
                <span>Search all of Adey Connect for <b>{q.trim()}</b></span>
              </button>
            </li>
          )}
        </ul>
      )}
    </form>
  );
});

/** Static stand-in while the search reads the address (keeps the header from jumping). */
export function SiteSearchFallback() {
  return (
    <div aria-hidden className="mx-auto flex h-12 w-full max-w-3xl items-center gap-3 rounded-full border border-border bg-surface px-5 shadow-md md:h-16 md:px-7">
      <Search className="h-4 w-4 text-text-muted md:hidden" /><span className="text-sm text-text-muted">Search Adey Connect</span>
    </div>
  );
}
