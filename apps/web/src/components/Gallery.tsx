'use client';
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

  if (!photos.length) return <div className="mt-6 grid h-56 place-items-center rounded-[24px] bg-forest-soft text-6xl sm:h-72" aria-label={`${name} has not added photos yet`}>🏪</div>;
  const shown = photos.slice(0, 5);
  const layout = shown.length === 1 ? 'sm:grid-cols-1' : shown.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-4 sm:grid-rows-2';
  return (
    <>
      <div className={`relative mt-6 grid h-64 gap-2 overflow-hidden rounded-[24px] sm:h-[420px] ${layout}`}>
        {shown.map((p, i) => {
          const big = i === 0 && shown.length >= 3;
          const span = big ? 'sm:col-span-2 sm:row-span-2' : shown.length === 3 && i > 0 ? 'sm:col-span-2' : shown.length === 4 && i === 3 ? 'sm:col-span-2' : '';
          return (
            <button key={p.url + i} type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}
              className={`group relative overflow-hidden bg-surface-muted ${i === 0 ? '' : 'hidden sm:block'} ${span}`}>
              <img src={p.url} alt={p.caption ?? (i === 0 ? name : '')} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] group-hover:brightness-95" loading={i === 0 ? 'eager' : 'lazy'} />
            </button>
          );
        })}
        {photos.length > 1 && (
          <button type="button" onClick={() => setOpen(0)} className="absolute bottom-3 right-3 rounded-[10px] border border-charcoal/20 bg-white px-3 py-1.5 text-sm font-semibold text-charcoal shadow-sm hover:bg-ivory">
            ▦ Show all {photos.length} photos
          </button>
        )}
      </div>
      {open != null && (
        <div role="dialog" aria-modal="true" aria-label={`${name} photos`} className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white">
          <div className="flex items-center justify-between p-4 text-sm">
            <span aria-live="polite">{open + 1} / {photos.length}</span>
            <button type="button" onClick={close} className="rounded-full bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20" autoFocus>✕ Close</button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
            <img src={photos[open].url} alt={photos[open].caption ?? `${name}, photo ${open + 1}`} className="max-h-full max-w-full object-contain" />
            {photos.length > 1 && <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/20">‹</button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/20">›</button>
            </>}
          </div>
          <p className="min-h-12 p-4 text-center text-sm text-white/80">{photos[open].caption ?? ''}</p>
        </div>
      )}
    </>
  );
}
