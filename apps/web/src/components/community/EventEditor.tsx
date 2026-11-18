'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';
import { ErrorLine, SignedIn } from './common';
import { EventForm } from './EventForm';

export function NewEvent({ businessId }: { businessId: string | null }) {
  return (
    <SignedIn what="the event form">
      <Page title="Submit an event"><Inner businessId={businessId} /></Page>
    </SignedIn>
  );
}
function Inner({ businessId }: { businessId: string | null }) {
  const { profile, session } = useAuth();
  const q = useQuery({ queryKey: ['events', 'can-submit', session?.user.id], queryFn: () => api.events.canSubmit(), enabled: !!session, staleTime: 0 });
  if (!profile || q.isLoading) return <div className="skeleton h-40" />;
  if (q.error || !q.data) return <ErrorLine error={q.error ?? new Error('Could not check whether you can post events.')} retry={() => q.refetch()} />;
  if (!q.data.allowed) return (
    <Empty title="Only verified businesses can post events" body="To keep the calendar trustworthy, events are posted by verified Adey businesses. Add your business and finish verification, then come back to post."
      action={<div className="flex flex-wrap justify-center gap-2"><Link href="/dashboard" className="btn btn-primary btn-sm">Your business dashboard</Link><Link href="/verification" className="btn btn-outline btn-sm">How verification works</Link></div>} />
  );
  if (q.data.mode === 'verified_businesses') {
    const list = q.data.businesses.filter((b) => b.verified);
    const pick = list.find((b) => b.id === businessId) ?? list[0];
    return <EventForm event={null} businessId={pick?.id ?? null} onlyBusinesses={list} />;
  }
  const valid = businessId && q.data.businesses.some((b) => b.id === businessId) ? businessId : null;
  return <EventForm event={null} businessId={valid} />;
}

export function EditEvent({ id }: { id: string }) {
  return <SignedIn what="this event"><Page title="Edit event"><Loader id={id} /></Page></SignedIn>;
}
function Loader({ id }: { id: string }) {
  const { session, profile } = useAuth();
  const q = useQuery({ queryKey: ['event-edit', id], queryFn: () => api.events.get(id), enabled: !!session, staleTime: 0 });
  if (q.isLoading || !profile) return <div className="skeleton h-64" />;
  if (q.error) return <ErrorLine error={q.error} retry={() => q.refetch()} />;
  if (!q.data || q.data.created_by !== session?.user.id) return <Empty title="Event not found" body="You can only edit events you submitted." />;
  if (q.data.status === 'cancelled') return <Empty title="This event was cancelled" body="Cancelled events cannot be edited." />;
  return <EventForm event={q.data} businessId={null} />;
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="container-x max-w-3xl pb-16"><h1 className="mt-8 mb-6 text-3xl font-bold">{title}</h1>{children}</div>;
}
