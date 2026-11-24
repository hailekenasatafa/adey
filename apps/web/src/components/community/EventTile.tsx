import Link from 'next/link';
import { MapPin, Video } from 'lucide-react';
import type { EventCard } from '@adey/shared';
import { mediaUrlFromPath } from '@/lib/media';
import { Badge, DateTile } from '@/components/ui';
import { categoryLabel, eventWhen, sourceLabel } from './eventTime';

/** Time of day in the event's own timezone ("7:00 PM EST"), or "All day". */
function timeOfDay(e: EventCard) {
  if (!e.starts_at) return '';
  if (e.all_day) return 'All day';
  let timeZone: string | undefined;
  try { if (e.timezone) { new Intl.DateTimeFormat('en-US', { timeZone: e.timezone }); timeZone = e.timezone; } } catch { timeZone = undefined; }
  return new Date(e.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short' });
}

/**
 * One event in the events list (Luma-style): time, title, host and place on the left, picture on the right.
 * Holidays and observances from partner calendars render as a lighter row: no RSVP, no venue, no picture.
 */
export function EventTile({ e, grouped = false }: { e: EventCard; grouped?: boolean }) {
  const img = mediaUrlFromPath('event-media', e.cover_path) ?? e.cover_url;
  const where = e.is_online ? 'Online' : [e.venue_name, e.city].filter(Boolean).join(', ');
  const from = sourceLabel(e.source_kind);
  const observance = !!from && e.all_day && !e.venue_name && !e.is_online;
  const href = `/events/${e.slug ?? e.id}`;

  if (observance) {
    return (
      <div className="relative flex items-center gap-4 rounded-[16px] border border-dashed border-border-strong px-4 py-3">
        <div className="photo h-12 w-12 shrink-0 !rounded-[10px]"><DateTile iso={e.starts_at} timeZone={e.timezone} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold"><Link href={href} className="after:absolute after:inset-0">{e.title}</Link></h3>
          <p className="truncate text-sm text-text-muted">{[categoryLabel(e.category), e.organizer_name ? `from ${e.organizer_name}` : `from ${from}`].filter(Boolean).join(', ')}</p>
        </div>
        {!grouped && <span className="hidden shrink-0 text-sm text-text-muted sm:block">{eventWhen(e)}</span>}
      </div>
    );
  }

  return (
    <div className="group relative flex gap-4 rounded-[16px] border border-border bg-surface p-4 transition hover:border-border-strong hover:shadow-md">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-text-muted">{grouped ? timeOfDay(e) : eventWhen(e, { withZone: true })}</p>
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug"><Link href={href} className="after:absolute after:inset-0">{e.title}</Link></h3>
        {e.organizer_name && <p className="truncate text-sm text-text-muted">By {e.organizer_name}</p>}
        <p className="flex items-center gap-1.5 truncate text-sm text-text-muted">
          {e.is_online ? <Video aria-hidden className="h-4 w-4" /> : <MapPin aria-hidden className="h-4 w-4" />}
          <span className="truncate">{where || 'Location to be announced'}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
          {e.is_free ? <Badge tone="success">Free</Badge> : <Badge tone="info">{e.price_note || 'Paid'}</Badge>}
          {e.category && <Badge>{categoryLabel(e.category)}</Badge>}
          {e.my_rsvp && <Badge tone="primary">{e.my_rsvp === 'going' ? 'You are going' : 'You are interested'}</Badge>}
          <span className="text-xs text-text-muted">{[(e.going_count ?? 0) > 0 ? `${e.going_count} going` : null, (e.interested_count ?? 0) > 0 ? `${e.interested_count} interested` : null].filter(Boolean).join(', ')}</span>
        </div>
        {((e.tags?.length ?? 0) > 0 || from) && (
          <div className="relative z-10 flex flex-wrap items-center gap-1.5 pt-1">
            {(e.tags ?? []).slice(0, 4).map((t) => <Link key={t} href={`/events?tag=${encodeURIComponent(t)}`} className="rounded-full px-1.5 text-xs text-text-muted hover:bg-surface-muted hover:text-text" aria-label={`Show events tagged ${t}`}>#{t}</Link>)}
            {from && <span className="text-xs text-text-muted">From {from}{e.external_url && <>, <a href={e.external_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text">view original</a></>}</span>}
          </div>
        )}
      </div>
      <div className="photo h-24 w-24 shrink-0 self-start !rounded-[12px] sm:h-28 sm:w-28">
        {img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <DateTile iso={e.starts_at} timeZone={e.timezone} />}
      </div>
    </div>
  );
}
