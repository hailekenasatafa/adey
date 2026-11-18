'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';
import { useStaff } from '@/components/admin/kit';

type Item = { href: string; label: string; perm?: string; queue?: string[] };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: '', items: [{ href: '/admin', label: 'Overview' }] },
  { title: 'Review', items: [
    { href: '/admin/kyc', label: 'Seller verification', perm: 'verification.review', queue: ['kyc'] },
    { href: '/admin/certifications', label: 'Badges', perm: 'catalog.moderate', queue: ['certifications'] },
    { href: '/admin/verifications', label: 'Business verification', perm: 'verification.review', queue: ['verifications'] },
    { href: '/admin/events', label: 'Events', perm: 'events.moderate', queue: ['events'] },
    { href: '/admin/event-sources', label: 'Event sources', perm: 'events.moderate' },
    { href: '/admin/reports', label: 'Reports', perm: 'moderation.content', queue: ['reports'] },
  ] },
  { title: 'Orders', items: [
    { href: '/admin/orders', label: 'Orders', perm: 'orders.view_all' },
    { href: '/admin/order-disputes', label: 'Order disputes', perm: 'disputes.resolve', queue: ['order_disputes'] },
    { href: '/admin/disputes', label: 'AdConnect disputes', perm: 'disputes.resolve', queue: ['booking_disputes'] },
  ] },
  { title: 'Money', items: [{ href: '/admin/finance', label: 'Finance', perm: 'finance.manage', queue: ['refunds', 'payouts'] }] },
  { title: 'Support', items: [
    { href: '/admin/support', label: 'Support inbox', perm: 'support.reply', queue: ['support'] },
    { href: '/admin/help', label: 'Help articles', perm: 'support.reply' },
  ] },
  { title: 'Platform', items: [
    { href: '/admin/announcements', label: 'Announcements', perm: 'announcements.send' },
    { href: '/admin/members', label: 'Members' },
    { href: '/admin/businesses', label: 'Businesses', perm: 'moderation.content' },
    { href: '/admin/settings', label: 'Settings' },
    { href: '/admin/audit', label: 'Audit log', perm: 'roles.manage' },
  ] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isStaff, loading } = useAuth();
  const path = usePathname();
  const staff = useStaff();
  const ov = useQuery({ queryKey: ['admin-overview'], queryFn: () => api.admin.overview(), enabled: isStaff, refetchInterval: 60_000 });
  if (loading) return <div className="container-x py-10"><div className="skeleton h-24" /></div>;
  if (!isStaff) return <div className="container-x py-16"><Empty title="Staff only" body="Your account doesn't have moderation permissions." /></div>;
  const queues = ov.data?.queues;
  const active = (h: string) => (h === '/admin' ? path === h : path === h || path.startsWith(h + '/'));
  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Administration</h1><span className="badge badge-danger">{staff.role === 'admin' ? 'Admin' : 'Staff'}</span></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Admin sections" className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {GROUPS.map((g) => {
            const items = g.items.filter((i) => !i.perm || staff.loading || staff.can(i.perm));
            if (!items.length) return null;
            return (
              <div key={g.title || 'top'}>
                {g.title && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{g.title}</p>}
                <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-1">
                  {items.map((i) => {
                    const n = (i.queue ?? []).reduce((s, k) => s + (queues?.[k as keyof typeof queues] ?? 0), 0);
                    return (
                      <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={`chip flex items-center justify-between gap-2 lg:rounded-lg ${active(i.href) ? 'chip-on' : ''}`}>
                        <span>{i.label}</span>{n > 0 && <span className="badge badge-danger">{n}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
