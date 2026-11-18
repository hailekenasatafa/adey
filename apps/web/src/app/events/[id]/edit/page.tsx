import { EditEvent } from '@/components/community/EventEditor';

export const metadata = { title: 'Edit event', robots: { index: false } };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditEvent id={decodeURIComponent((await params).id)} />;
}
