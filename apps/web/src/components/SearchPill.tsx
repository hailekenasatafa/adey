import type { ReactNode } from 'react';
import { CleanForm } from '@/components/CleanForm';

/** The one search box at the top of a list page: rounded, with a round search button (Airbnb-style). */
export function SearchPill({ action, defaultValue, placeholder, children }: { action: string; defaultValue?: string; placeholder: string; children?: ReactNode }) {
  return (
    <CleanForm action={action} role="search" aria-label={placeholder} className="flex min-w-0 flex-1 items-center rounded-full border border-border bg-surface p-1.5 pl-5 shadow-sm focus-within:ring-2 focus-within:ring-forest">
      {children}
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-text-muted" />
      <button aria-label="Search" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-[color:var(--on-forest)] transition hover:brightness-110">
        <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
      </button>
    </CleanForm>
  );
}

/** Label for the single Filters button. */
export function FiltersLabel() {
  return (
    <>
      <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4 shrink-0"><path d="M3 5h14M5.5 10h9M8 15h4" /></svg>
      <span className="max-sm:sr-only">Filters</span>
    </>
  );
}
