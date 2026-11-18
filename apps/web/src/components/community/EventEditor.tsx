'use client';
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
  const { profile, businesses } = useAuth();
  if (!profile) return <div className="skeleton h-40" />;
  const valid = businessId && businesses.some((b) => b.id === businessId) ? businessId : null;
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
