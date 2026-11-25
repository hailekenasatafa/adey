import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { countryName, eventCategoryLabels } from '@adey/shared';
import { serverApi, SITE_URL } from '@/lib/supabase/server';
import { mediaUrlFromPath } from '@/lib/media';
import { Badge } from '@/components/ui';
import { Paragraphs } from '@/components/community/common';
import { EventActions } from '@/components/community/EventActions';
import { ReportButton } from '@/components/ReportButton';
import { eventEnds, eventWhen, hasEnded, sourceLabel } from '@/components/community/eventTime';

type Props = { params: Promise<{ id: string }> };
const load = async (id: string) => (await serverApi()).events.get(decodeURIComponent(id)).catch(() => null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await load((await params).id);
  if (!e || e.status !== 'published') return { title: 'Event', robots: { index: false } };
  const desc = (e.description ?? `${eventCategoryLabels[e.category]} · ${eventWhen(e)}`).slice(0, 200);
  const img = mediaUrlFromPath('event-media', e.cover_path) ?? e.cover_url;
  return { title: e.title, description: desc, alternates: { canonical: `/events/${e.slug}` }, openGraph: { title: e.title, description: desc, type: 'website', ...(img ? { images: [img] } : {}) } };
}

export default async function EventPage({ params }: Props) {
  const e = await load((await params).id);
  if (!e) notFound();
  const img = mediaUrlFromPath('event-media', e.cover_path);
  const coverImg = img ?? e.cover_url;
  const from = sourceLabel(e.source_kind);
  const published = e.status === 'published';
  const over = hasEnded(e);
  const address = [e.address_line1, e.city, e.state, e.postal_code, countryName(e.country)].filter(Boolean).join(', ');
  // Only offer a map when there is a real place (public holidays are listed as "Nationwide").
  const mapQuery = e.address_line1 || e.city ? [e.venue_name, address].filter(Boolean).join(', ') : '';
  const end = eventEnds(e, { withZone: true });
  const jsonLd = published ? {
    '@context': 'https://schema.org', '@type': 'Event', name: e.title, startDate: e.starts_at, ...(e.ends_at ? { endDate: e.ends_at } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: e.is_online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    ...(e.description ? { description: e.description } : {}), ...(img ? { image: [img] } : {}), url: `${SITE_URL}/events/${e.slug}`,
    location: e.is_online ? (e.online_url ? { '@type': 'VirtualLocation', url: e.online_url } : undefined)
      : { '@type': 'Place', name: e.venue_name ?? e.city ?? undefined, address: { '@type': 'PostalAddress', streetAddress: e.address_line1 ?? undefined, addressLocality: e.city ?? undefined, addressRegion: e.state ?? undefined, postalCode: e.postal_code ?? undefined, addressCountry: e.country } },
    ...(e.organizer_name || e.business?.name ? { organizer: { '@type': 'Organization', name: e.organizer_name ?? e.business?.name } } : {}),
    ...(e.is_free ? { isAccessibleForFree: true } : {}),
  } : null;
  return (
    <div className="container-x max-w-4xl pb-16">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <nav aria-label="Breadcrumb" className="mt-6 text-sm text-text-muted"><Link href="/events" className="hover:underline">Events</Link> / <span>{e.title}</span></nav>
      {!published && <p role="status" className="mt-4 card p-4 text-sm"><Badge tone={e.status === 'cancelled' || e.status === 'rejected' ? 'danger' : 'warning'}>{{ draft: 'Draft', pending: 'Waiting for review', rejected: 'Not approved', cancelled: 'Cancelled', published: '' }[e.status]}</Badge> Only you can see this page.{e.status === 'rejected' && e.rejection_reason ? ` Reason: ${e.rejection_reason}` : ''}</p>}
      <div className={`mt-4 overflow-hidden rounded-[20px] bg-forest-soft${coverImg ? ' aspect-square w-full max-w-[420px]' : ''}`}>{coverImg ? <img src={coverImg} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <div className="grid h-40 place-items-center text-forest"><CalendarDays aria-hidden className="h-12 w-12" strokeWidth={1.25} /></div>}</div>
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_300px]">
        <div>
          <div className="flex flex-wrap gap-1.5"><Badge>{eventCategoryLabels[e.category]}</Badge>{e.is_free ? <Badge tone="success">Free</Badge> : <Badge tone="info">{e.price_note || 'Paid'}</Badge>}{e.is_online && <Badge tone="primary">Online</Badge>}{over && published && <Badge tone="neutral">Ended</Badge>}</div>
          {(e.tags ?? []).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{e.tags.map((t) => <Link key={t} href={`/events?tag=${encodeURIComponent(t)}`} className="chip !px-2 !py-0.5 text-xs">#{t}</Link>)}</div>}
          <h1 className="mt-2 text-3xl font-bold">{e.title}</h1>
          {from && <p className="mt-1 text-sm text-text-muted">From {from}{e.external_url && <> · <a href={e.external_url} target="_blank" rel="noopener noreferrer" className="text-forest underline">View original</a></>}</p>}
          {e.title_am && <p className="ethiopic text-lg text-text-muted">{e.title_am}</p>}
          {e.description ? <Paragraphs text={e.description} className="mt-5" /> : <p className="mt-5 text-text-muted">The organiser has not added a description.</p>}
        </div>
        <aside className="space-y-5">
          <section className="card space-y-3 p-4 text-sm">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">When</p><p className="font-medium">{eventWhen(e, { withZone: true, year: true })}</p>{end && <p className="text-text-muted">until {end}</p>}</div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Where</p>
              {e.is_online ? <p className="font-medium">Online{e.online_url && <> · <a href={e.online_url} target="_blank" rel="noreferrer noopener" className="text-forest underline">Join link</a></>}</p>
                : <><p className="font-medium">{e.venue_name ?? e.city ?? 'To be announced'}</p>{address && <p className="text-text-muted">{address}</p>}{mapQuery && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer noopener" className="text-forest underline">Open in maps</a>}</>}
            </div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Organiser</p>
              {e.business ? <Link href={`/business/${e.business.slug}`} className="font-medium text-forest hover:underline">{e.business.name}</Link> : <p className="font-medium">{e.organizer_name ?? 'Community member'}</p>}
              {e.contact_email && <p><a href={`mailto:${e.contact_email}`} className="text-forest underline">{e.contact_email}</a></p>}{e.contact_phone && <p>{e.contact_phone}</p>}
            </div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Price</p><p className="font-medium">{e.is_free ? 'Free' : e.price_note || 'See ticket link'}</p>{e.ticket_url && <a href={e.ticket_url} target="_blank" rel="noreferrer noopener" className="btn btn-accent btn-sm mt-2">Tickets / more info</a>}</div>
          </section>
          <EventActions open={published && !over} rsvp={!from} createdBy={e.created_by} going={e.going_count} interested={e.interested_count}
            event={{ id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, timezone: e.timezone, all_day: e.all_day, description: e.description, venue_name: e.venue_name, address_line1: e.address_line1, city: e.city, state: e.state, is_online: e.is_online, online_url: e.online_url, url: '' }} />
          {published && <p className="text-right"><ReportButton targetType="event" targetId={e.id} label="Report this event" /></p>}
        </aside>
      </div>
    </div>
  );
}
