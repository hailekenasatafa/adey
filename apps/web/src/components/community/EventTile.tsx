import Link from 'next/link';
import type { EventCard } from '@adey/shared';
import { mediaUrlFromPath } from '@/lib/media';
import { Badge } from '@/components/ui';
import { categoryLabel, eventWhen } from './eventTime';

export function EventTile({ e }: { e: EventCard }) {
  const img = mediaUrlFromPath('event-media', e.cover_path);
  const where = e.is_online ? 'Online' : [e.venue_name, e.city].filter(Boolean).join(' · ');
  return (
    <Link href={`/events/${e.slug ?? e.id}`} className="card flex overflow-hidden transition hover:shadow-md">
      <div className="hidden h-auto w-32 shrink-0 bg-forest-soft sm:block">{img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-3xl">🎉</div>}</div>
      <div className="min-w-0 flex-1 space-y-1 p-4">
        <p className="text-xs font-semibold text-forest">{eventWhen(e, { withZone: true })}</p>
        <h3 className="line-clamp-2 font-semibold">{e.title}</h3>
        <p className="truncate text-xs text-text-muted">{where || 'Location to be announced'}{e.organizer_name ? ` · by ${e.organizer_name}` : ''}</p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {e.category && <Badge>{categoryLabel(e.category)}</Badge>}
          {e.is_free ? <Badge tone="success">Free</Badge> : <Badge tone="info">{e.price_note || 'Paid'}</Badge>}
          {e.my_rsvp && <Badge tone="primary">{e.my_rsvp === 'going' ? 'You are going' : 'You are interested'}</Badge>}
          <span className="text-xs text-text-muted">{[(e.going_count ?? 0) > 0 ? `${e.going_count} going` : null, (e.interested_count ?? 0) > 0 ? `${e.interested_count} interested` : null].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
    </Link>
  );
}
