'use client';
import { ChevronLeft, ChevronRight, LayoutGrid, Store, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Photo = { url: string; caption?: string | null };

/**
 * Photo grid for a business page: one large photo and up to four smaller ones (one photo on phones),
 * with "Show all photos" opening a full-screen viewer (arrow keys, Escape, swipe-free buttons).
 */
export function Gallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + photos.length) % photos.length)), [photos.length]);
  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, close, step]);

  if (!photos.length) return <div className="mt-6 grid h-56 place-items-center rounded-[24px] bg-forest-soft text-forest sm:h-72" aria-label={`${name} has not added photos yet`}><Store aria-hidden className="h-12 w-12" strokeWidth={1.25} /></div>;
  // Every tile is square: one photo, two side by side, a large photo with two stacked beside it, or a large
  // photo with four around it. Phones show the first photo only; "Show all photos" opens the rest.
  const shown = photos.slice(0, photos.length >= 5 ? 5 : photos.length >= 3 ? 3 : photos.length);
  const layout = shown.length === 1 ? 'sm:max-w-[480px]'
    : shown.length === 2 ? 'sm:aspect-[2/1] sm:max-w-[960px] sm:grid-cols-2'
    : shown.length === 3 ? 'sm:aspect-[3/2] sm:max-w-[720px] sm:grid-cols-3 sm:grid-rows-2'
    : 'sm:aspect-[2/1] sm:max-w-[960px] sm:grid-cols-4 sm:grid-rows-2';
  return (
    <>
      <div className={`relative mt-6 grid aspect-square gap-2 overflow-hidden rounded-[24px] ${layout}`}>
        {shown.map((p, i) => {
          const span = i === 0 && shown.length >= 3 ? 'sm:col-span-2 sm:row-span-2' : '';
          return (
            <button key={p.url + i} type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}
              className={`group relative overflow-hidden bg-surface-muted ${i === 0 ? '' : 'hidden sm:block'} ${span}`}>
              <img src={p.url} alt={p.caption ?? (i === 0 ? name : '')} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] group-hover:brightness-95" loading={i === 0 ? 'eager' : 'lazy'} />
            </button>
          );
        })}
        {photos.length > 1 && (
          <button type="button" onClick={() => setOpen(0)} className="absolute bottom-3 right-3 rounded-[10px] border border-charcoal/20 bg-white px-3 py-1.5 text-sm font-semibold text-charcoal shadow-sm hover:bg-ivory">
            <LayoutGrid aria-hidden className="h-4 w-4" />Show all {photos.length} photos
          </button>
        )}
      </div>
      {open != null && (
        <div role="dialog" aria-modal="true" aria-label={`${name} photos`} className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white">
          <div className="flex items-center justify-between p-4 text-sm">
            <span aria-live="polite">{open + 1} / {photos.length}</span>
            <button type="button" onClick={close} className="rounded-full bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20 inline-flex items-center gap-1.5" autoFocus><X aria-hidden className="h-4 w-4" />Close</button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
            <img src={photos[open].url} alt={photos[open].caption ?? `${name}, photo ${open + 1}`} className="max-h-full max-w-full object-contain" />
            {photos.length > 1 && <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronLeft aria-hidden className="h-6 w-6" /></button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"><ChevronRight aria-hidden className="h-6 w-6" /></button>
            </>}
          </div>
          <p className="min-h-12 p-4 text-center text-sm text-white/80">{photos[open].caption ?? ''}</p>
        </div>
      )}
    </>
  );
}
