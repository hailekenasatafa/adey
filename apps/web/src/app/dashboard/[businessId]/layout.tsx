'use client';
import { ArrowLeft, BadgeCheck, Banknote, CalendarCheck, CalendarDays, ChartLine, ClipboardList, Clock, ExternalLink, Images, Inbox, Landmark, LayoutDashboard, Megaphone, MessageCircle, MonitorPlay, Package, ShieldCheck, ShoppingBag, SquarePen, Star, TicketPercent, Truck, Users, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { usePerms } from '@/components/seller/common';
import { useCommerce } from '@/lib/commerce';
import { useAdconnect } from '@/lib/settings';

const NAV = [
  ['', 'Overview', LayoutDashboard], ['edit', 'Details', SquarePen], ['photos', 'Photos', Images], ['hours', 'Hours', Clock], ['services', 'Menu & services', ClipboardList], ['deals', 'Deals', TicketPercent], ['products', 'Products', ShoppingBag], ['inquiries', 'Inquiries', MessageCircle], ['reviews', 'Reviews', Star], ['verification', 'Verification', ShieldCheck], ['analytics', 'Analytics', ChartLine], ['team', 'Team', Users],
] as const;
/** [segment, label, icon, needs the campaign tools switched on] */
const AD_NAV = [['screens', 'My screens', MonitorPlay, false], ['requests', 'Ad requests', Inbox, true], ['bookings', 'Bookings', CalendarCheck, true], ['earnings', 'Earnings', Wallet, true]] as const;
/** [segment, label, icon, permissions (any of) — empty means everyone] */
const SELLING: readonly (readonly [string, string, LucideIcon, readonly string[]])[] = [
  ['orders', 'Orders', Package, ['orders.fulfill']], ['shipping', 'Delivery', Truck, ['shipping.manage']], ['kyc', 'Seller verification', BadgeCheck, ['kyc.manage']],
  ['payouts', 'Payouts', Landmark, ['payouts.manage', 'finance.view']], ['sales', 'Sales', Banknote, ['finance.view']],
];

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { businessId } = useParams<{ businessId: string }>();
  const path = usePathname();
  const { businesses, loading } = useAuth();
  const { can, loading: permsLoading } = usePerms(businessId);
  const { checkoutEnabled } = useCommerce();
  const { campaignsEnabled } = useAdconnect();
  const b = businesses.find((x) => x.id === businessId);
  if (!loading && !b) return <div className="container-x py-16"><p>You don't manage this business.</p><Link href="/dashboard" className="btn btn-primary mt-4">My businesses</Link></div>;
  const item = (seg: string, label: string, Icon: LucideIcon) => {
    const href = `/dashboard/${businessId}${seg ? '/' + seg : ''}`; const active = seg ? path.startsWith(href) : path === href;
    return <Link key={seg} href={href} className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm ${active ? 'bg-surface-muted font-semibold text-text' : 'text-text-muted hover:bg-surface-muted hover:text-text'}`}><Icon aria-hidden className={`h-[18px] w-[18px] ${active ? 'text-forest' : ''}`} />{label}</Link>;
  };
  const head = (t: string) => <p className="mb-1 mt-5 px-3 text-xs font-semibold text-text-muted">{t}</p>;
  return (
    <div className="container-x grid gap-8 pb-16 lg:grid-cols-[240px_1fr]">
      <aside className="mt-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text"><ArrowLeft aria-hidden className="h-4 w-4" />All businesses</Link>
        <h2 className="mt-3 text-xl font-semibold leading-tight">{b?.name ?? '…'}</h2>
        {b && <div className="mt-1 flex gap-1"><Badge tone={b.status === 'published' ? 'success' : 'warning'}>{b.status}</Badge><Badge tone="neutral">{b.role}</Badge></div>}
        <nav className="mt-5 space-y-0.5" aria-label="Business dashboard">
          {NAV.map(([seg, label, icon]) => item(seg, label, icon))}
          {item('events', 'Events', CalendarDays)}
          {checkoutEnabled && <>
            {head('Online orders')}
            {SELLING.filter(([, , , need]) => !need.length || (!permsLoading && need.some((p) => can(p)))).map(([seg, label, icon]) => item(seg, label, icon))}
          </>}
          {head('AdConnect')}
          {AD_NAV.filter(([, , , needsCampaigns]) => campaignsEnabled || !needsCampaigns).map(([seg, label, icon]) => item(seg, label, icon))}
          {campaignsEnabled && <>
            {head('Advertiser')}
            <Link href={`/campaigns?businessId=${businessId}`} className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><Megaphone aria-hidden className="h-[18px] w-[18px]" />Campaigns</Link>
          </>}
          {b?.slug && <Link href={`/business/${b.slug}`} className="mt-4 flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><ExternalLink aria-hidden className="h-[18px] w-[18px]" />View public page</Link>}
        </nav>
      </aside>
      <section className="mt-8 min-w-0">{children}</section>
    </div>
  );
}
