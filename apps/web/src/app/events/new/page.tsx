import { NewEvent } from '@/components/community/EventEditor';

export const metadata = { title: 'Submit an event', robots: { index: false } };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  return <NewEvent businessId={typeof businessId === 'string' ? businessId : null} />;
}
