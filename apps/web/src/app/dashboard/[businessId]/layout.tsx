'use client';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';

const NAV = [
  ['', 'Overview', '📊'], ['edit', 'Details', '✏️'], ['photos', 'Photos', '🖼️'], ['hours', 'Hours', '🕒'], ['products', 'Products', '🛍️'], ['services', 'Services', '🧰'], ['inquiries', 'Inquiries', '💬'], ['verification', 'Verification', '🛡️'], ['analytics', 'Analytics', '📈'], ['team', 'Team', '👥'],
  ['screens', 'My screens', '📺'], ['requests', 'Ad requests', '📩'], ['bookings', 'Bookings', '📅'], ['earnings', 'Earnings', '💰'],
] as const;

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { businessId } = useParams<{ businessId: string }>();
  const path = usePathname();
  const { businesses, loading } = useAuth();
  const b = businesses.find((x) => x.id === businessId);
  if (!loading && !b) return <div className="container-x py-16"><p>You don't manage this business.</p><Link href="/dashboard" className="btn btn-primary mt-4">My businesses</Link></div>;
  return (
    <div className="container-x grid gap-8 pb-16 lg:grid-cols-[240px_1fr]">
      <aside className="mt-8">
        <Link href="/dashboard" className="text-xs font-semibold text-forest">← All businesses</Link>
        <h2 className="mt-2 text-xl font-bold leading-tight">{b?.name ?? '…'}</h2>
        {b && <div className="mt-1 flex gap-1"><Badge tone={b.status === 'published' ? 'success' : 'warning'}>{b.status}</Badge><Badge tone="neutral">{b.role}</Badge></div>}
        <nav className="mt-5 space-y-0.5">
          {NAV.map(([seg, label, icon], i) => { const href = `/dashboard/${businessId}${seg ? '/' + seg : ''}`; const active = seg ? path.startsWith(href) : path === href; return (
            <div key={seg}>{i === 10 && <p className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">AdConnect</p>}<Link href={href} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${active ? 'bg-forest-soft font-semibold text-forest' : 'hover:bg-surface-muted'}`}><span>{icon}</span>{label}</Link></div>
          ); })}
          <p className="mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">Advertiser</p>
          <Link href={`/campaigns?businessId=${businessId}`} className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm hover:bg-surface-muted">📣 Campaigns</Link>
          {b?.slug && <Link href={`/business/${b.slug}`} className="mt-4 flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-text-muted hover:bg-surface-muted">👁 View public page</Link>}
        </nav>
      </aside>
      <section className="mt-8 min-w-0">{children}</section>
    </div>
  );
}
