'use client';
import { Check } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { RsvpStatus } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { ErrorLine } from './common';
import { buildIcs, downloadText } from './eventTime';

type Ev = Parameters<typeof buildIcs>[0];

/** `rsvp={false}` for entries from public calendars (holidays): no Going/Interested, just calendar and share. */
export function EventActions({ event, createdBy, going: g0, interested: i0, open, rsvp: offerRsvp = true }: { event: Ev; createdBy: string; going: number; interested: number; open: boolean; rsvp?: boolean }) {
  const { session } = useAuth();
  const path = usePathname();
  const [counts, setCounts] = useState({ going: g0, interested: i0 });
  const [note, setNote] = useState<string | null>(null);
  const mine = useQuery({ queryKey: ['rsvp', event.id, session?.user.id], queryFn: () => api.events.myRsvp(event.id), enabled: !!session });
  const rsvp = useMutation({
    mutationFn: (s: RsvpStatus | 'none') => api.events.rsvp(event.id, s),
    onSuccess: (r) => { setCounts({ going: r.going_count, interested: r.interested_count }); mine.refetch(); },
  });
  const current = mine.data ?? null;
  const pick = (s: RsvpStatus) => rsvp.mutate(current === s ? 'none' : s);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else { await navigator.clipboard.writeText(url); setNote('Link copied.'); }
    } catch { /* share dismissed */ }
  };
  const btn = (s: RsvpStatus, label: string) => (
    <button type="button" aria-pressed={current === s} disabled={rsvp.isPending} onClick={() => pick(s)} className={`btn btn-sm ${current === s ? 'btn-primary' : 'btn-outline'}`}>{current === s && <Check aria-hidden className="h-4 w-4" />}{label}</button>
  );
  return (
    <div className="space-y-3">
      {open && offerRsvp && (session ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Your response">{btn('going', "I'm going")}{btn('interested', 'Interested')}</div>
      ) : <Link href={`/auth/sign-in?next=${encodeURIComponent(path)}`} className="btn btn-primary btn-sm">Sign in to say you are going</Link>)}
      {offerRsvp && <p className="text-sm text-text-muted">{counts.going} going · {counts.interested} interested</p>}
      {rsvp.error && <ErrorLine error={rsvp.error} />}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadText(`${event.title.replace(/[^\w]+/g, '-').slice(0, 40) || 'event'}.ics`, buildIcs({ ...event, url: window.location.href }), 'text/calendar')}>Add to calendar</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={share}>Share</button>
        {session?.user.id === createdBy && <Link href={`/events/${event.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>}
      </div>
      {note && <p role="status" className="text-xs text-text-muted">{note}</p>}
    </div>
  );
}
