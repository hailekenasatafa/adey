import { SupportHome } from '@/components/community/Support';

export const metadata = { title: 'Support', robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <SupportHome orderId={typeof order === 'string' && UUID.test(order) ? order : null} />;
}
