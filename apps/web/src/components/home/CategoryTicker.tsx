import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export type TickerItem = { label: string; href: string; icon: LucideIcon };

/** How many copies of the list make up the moving track. Two halves of two copies each keep the loop seamless on very wide screens. */
const COPIES = 4;

/**
 * An endless, slowly moving strip of category pills (marquee). The track holds identical copies of the
 * list and moves by exactly half its width, so the reset is invisible. It pauses on hover and when a
 * pill has keyboard focus. Only the first copy is in the tab order and read by screen readers; the
 * copies are decorative but still clickable. With reduced motion it becomes a still, swipeable row.
 */
export function CategoryTicker({ items, label = 'Popular categories' }: { items: TickerItem[]; label?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label={label} className="ticker">
      <div className="ticker-track">
        {Array.from({ length: COPIES }, (_, copy) => (
          <ul key={copy} className="ticker-group" aria-hidden={copy > 0 || undefined} data-clone={copy > 0 || undefined}>
            {items.map(({ label: name, href, icon: Icon }) => (
              <li key={name}>
                <Link href={href} className="ticker-pill" tabIndex={copy > 0 ? -1 : undefined}>
                  <span className="ticker-pill-icon"><Icon aria-hidden className="h-4 w-4" /></span>
                  <span className="whitespace-nowrap">{name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </nav>
  );
}
