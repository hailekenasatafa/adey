import { SupportChat } from '@/components/community/Support';

export const metadata = { title: 'Support conversation', robots: { index: false } };

export default async function SupportThreadPage({ params }: { params: Promise<{ id: string }> }) {
  return <SupportChat id={(await params).id} />;
}
