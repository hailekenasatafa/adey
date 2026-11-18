import Link from 'next/link';
import type { EventCard } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { EventsBrowser } from '@/components/community/EventsBrowser';

export const metadata = { title: 'Community events', description: 'Festivals, holiday markets, live music, faith and family gatherings across the Habesha community.' };
export const dynamic = 'force-dynamic';

type Region = { name: string };
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const api = await serverApi();
  const settings = await api.settings.get<{ regions?: Record<string, Region> }>('events').catch(() => undefined);
  const regions = Object.entries(settings?.regions ?? {}).map(([key, r]) => ({ key, name: r.name }));
  const region = regions.some((r) => r.key === one(sp.region)) ? one(sp.region) : '';
  const tag = /^[a-z0-9-]{1,40}$/.test(one(sp.tag).toLowerCase()) ? one(sp.tag).toLowerCase() : '';
  const initial: EventCard[] = await api.events.search({ p_limit: 60, p_region: region || undefined, p_tag: tag || undefined }).catch(() => []);
  const canPost = await api.events.canSubmit().then((c) => c.allowed).catch(() => null);
  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Community events</h1><p className="mt-1 text-text-muted">Festivals, markets, music and gatherings near you and online.</p></div>
        <div className="flex gap-2"><Link href="/events/mine" className="btn btn-outline btn-sm">My submissions</Link>{canPost && <Link href="/events/new" className="btn btn-primary btn-sm">Submit an event</Link>}</div>
      </div>
      <EventsBrowser initial={initial} regions={regions} region={region} tag={tag} canPost={!!canPost} />
    </div>
  );
}
