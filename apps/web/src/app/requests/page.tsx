'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';

/** Convenience entry: send screen owners to their first business's incoming-requests page. */
export default function RequestsIndex() {
  const { businesses, loading } = useAuth();
  const router = useRouter();
  const owner = businesses.find((b) => b.offers_ad_screens || (b.screen_count ?? 0) > 0) ?? businesses[0];
  useEffect(() => { if (owner) router.replace(`/dashboard/${owner.id}/requests`); }, [owner?.id]);
  if (loading || owner) return <div className="container-x py-10"><div className="skeleton h-24" /></div>;
  return <div className="container-x py-16"><Empty title="No screens listed yet" body="Advertising requests arrive once you list a screen." action={<Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>} /></div>;
}
