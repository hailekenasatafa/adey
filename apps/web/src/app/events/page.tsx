import Link from 'next/link';
import type { EventCard } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { EventsBrowser } from '@/components/community/EventsBrowser';

export const metadata = { title: 'Community events', description: 'Festivals, holiday markets, live music, faith and family gatherings across the Habesha community.' };
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const api = await serverApi();
  const initial: EventCard[] = await api.events.search({ p_limit: 60 }).catch(() => []);
  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Community events</h1><p className="mt-1 text-text-muted">Festivals, markets, music and gatherings near you and online.</p></div>
        <div className="flex gap-2"><Link href="/events/mine" className="btn btn-outline btn-sm">My submissions</Link><Link href="/events/new" className="btn btn-primary btn-sm">Submit an event</Link></div>
      </div>
      <EventsBrowser initial={initial} />
    </div>
  );
}
