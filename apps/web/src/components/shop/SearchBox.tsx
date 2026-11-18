'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { SearchSuggestion } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { mediaUrlFromPath } from '@/lib/media';

const hrefFor = (s: SearchSuggestion) =>
  s.type === 'product' ? `/product/${s.id}` : s.type === 'business' ? `/business/${s.slug ?? s.id}` : s.type === 'event' ? `/events/${s.id}` : `/market?category=${s.id}`;
const icon = { product: '🛍️', business: '🏪', category: '🏷️', event: '📅' } as const;

/** Search field with debounced type-ahead from search_suggestions. */
export function SearchBox({ initial = '' }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const s = useQuery({ queryKey: ['suggest', debounced], queryFn: () => api.shop.suggestions(debounced), enabled: debounced.length >= 2, staleTime: 60_000 });
  const items = open && q.trim().length >= 2 ? s.data ?? [] : [];
  return (
    <form role="search" className="relative mt-8 flex gap-2" onSubmit={(e) => { e.preventDefault(); setOpen(false); if (active >= 0 && items[active]) router.push(hrefFor(items[active])); else router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
      <input
        value={q} autoFocus placeholder="Products, businesses, events, cities…" className="input h-12" aria-label="Search"
        role="combobox" aria-expanded={items.length > 0} aria-controls="suggestions" aria-autocomplete="list" aria-activedescendant={active >= 0 ? `sugg-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <button className="btn btn-primary">Search</button>
      {items.length > 0 && (
        <ul id="suggestions" role="listbox" className="card absolute left-0 right-0 top-14 z-30 max-h-96 overflow-auto p-1 shadow-lg sm:right-28">
          {items.map((x, i) => {
            const img = x.image ? mediaUrlFromPath(x.type === 'product' ? 'product-media' : 'business-media', x.image) : null;
            return (
              <li key={`${x.type}-${x.id}`} id={`sugg-${i}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); router.push(hrefFor(x)); }} className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm ${i === active ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-surface-muted">{img ? <img src={img} alt="" className="h-full w-full object-cover" /> : icon[x.type]}</span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{x.label}</span>{x.sublabel && <span className="block truncate text-xs text-text-muted">{x.sublabel}</span>}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
