'use client';
import { useEffect, useRef, type ReactNode, type SyntheticEvent } from 'react';
import Link from 'next/link';

/**
 * A toolbar button that opens a panel (filters, categories) instead of showing every option on the page.
 * Built on <details>, so it works before JavaScript loads. Closes on an outside click, Escape, a link click,
 * a form submit, or a click on anything marked data-close. Put it inside a `relative` toolbar: on phones the
 * panel spans the toolbar's width, from `sm` up it sits under its button, right-aligned by default because
 * the buttons sit at the end of the toolbar.
 */
export function Dropdown({ label, count = 0, active = false, align = 'end', wide = false, size, children }: {
  label: ReactNode; count?: number; active?: boolean; align?: 'start' | 'end'; wide?: boolean; size?: 'sm' | 'md' | 'lg'; children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => { if (el.open && !el.contains(e.target as Node)) el.open = false; };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && el.open) { el.open = false; el.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);
  const close = (e: SyntheticEvent) => {
    const t = e.target as HTMLElement;
    if (e.type === 'submit' || t.closest('a[href]') || t.closest('[data-close]')) { if (ref.current) ref.current.open = false; }
  };
  const on = active || count > 0;
  const width = { sm: 'sm:w-60', md: 'sm:w-80', lg: 'sm:w-[34rem]' }[size ?? (wide ? 'lg' : 'md')];
  return (
    <details ref={ref} className="group sm:relative">
      <summary className={`chip cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden ${on ? 'chip-on' : ''}`}>
        <span className="flex max-w-[14rem] items-center gap-1.5 truncate">{label}</span>
        {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-surface px-1 text-[11px] font-bold text-forest" aria-label={`${count} active`}>{count}</span>}
        <span aria-hidden className="text-xs transition group-open:rotate-180">▾</span>
      </summary>
      <div onClick={close} onSubmit={close}
        className={`absolute inset-x-0 z-40 mt-2 max-h-[70vh] overflow-auto rounded-[20px] border border-border bg-surface p-4 shadow-xl sm:inset-x-auto ${align === 'end' ? 'sm:right-0' : 'sm:left-0'} ${width}`}>
        {children}
      </div>
    </details>
  );
}

/** One-tap choice list for a Dropdown (categories, for example). */
export function MenuLinks({ items, label, columns = 2 }: { items: { href: string; label: string; current: boolean }[]; label: string; columns?: 1 | 2 }) {
  return (
    <nav aria-label={label} className={`grid gap-1 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {items.map((i) => (
        <Link key={i.href + i.label} href={i.href} aria-current={i.current ? 'true' : undefined}
          className={`rounded-[10px] px-3 py-2 text-sm ${i.current ? 'bg-forest-soft font-semibold text-forest' : 'hover:bg-surface-muted'}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Same look as MenuLinks for client-side lists (buttons instead of links). */
export function MenuButtons({ items, label, onPick }: { items: { value: string; label: string; current: boolean }[]; label: string; onPick: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} className="grid gap-1 sm:grid-cols-2">
      {items.map((i) => (
        <button key={i.value || 'all'} type="button" data-close aria-pressed={i.current} onClick={() => onPick(i.value)}
          className={`rounded-[10px] px-3 py-2 text-left text-sm ${i.current ? 'bg-forest-soft font-semibold text-forest' : 'hover:bg-surface-muted'}`}>
          {i.label}
        </button>
      ))}
    </div>
  );
}
